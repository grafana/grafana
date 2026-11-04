const seconds = (ms) => `${(ms / 1000).toFixed(3)} s`;
const sum = (values) => values.reduce((a, b) => a + b, 0);

function summarize(data) {
  const categories = {};
  for (const buckets of Object.values(data.phases)) {
    for (const [name, ms] of Object.entries(buckets)) categories[name] = (categories[name] ?? 0) + ms;
  }
  const modules = Object.entries(data.modules);
  const processes = data.rows.filter((row) => row.category === 'transformer process');
  const runStart = data.events.find((event) => event.name === 'run_start');
  const runFinish = data.events.find((event) => event.name === 'run_finish');
  return {
    complete: Boolean(runStart && runFinish),
    beforeTestsMs: runStart?.time,
    testsAndHooksMs: runStart && runFinish ? runFinish.time - runStart.time : undefined,
    phases: Object.fromEntries(Object.entries(data.phases).map(([name, buckets]) => [name, sum(Object.values(buckets))])),
    categories,
    uniqueModules: modules.length,
    moduleExecutions: sum(modules.map(([, row]) => row.executions)),
    transformProcessCalls: sum(processes.map((row) => row.calls)),
    transformedFiles: processes.length,
    transformedDependencyFiles: processes.filter((row) => /(^|\/)node_modules\//.test(row.label)).length,
    matcherCalls: sum(data.events.filter((event) => event.name === 'test body result').map((event) => event.assertions ?? 0)),
  };
}

function formatReport(label, data, wallMs, result) {
  const summary = summarize(data);
  const lines = [`\n=== ${label} ===`, `Process wall: ${seconds(wallMs)} | attributed interval: ${seconds(data.elapsedMs)} | process exit: ${result.code}`];
  lines.push(`Node ${data.node} | Jest ${data.jest} | PID ${data.pid} | peak RSS ${(data.resources.maxRSS / 1024).toFixed(0)} MiB`);
  lines.push(`Process CPU: user ${(data.cpu.user / 1e6).toFixed(3)} s, system ${(data.cpu.system / 1e6).toFixed(3)} s`);
  if (!summary.complete) lines.push('INCOMPLETE: the suite did not reach both run_start and run_finish.');
  lines.push('\nLifecycle wall time (disjoint):');
  for (const [name, ms] of Object.entries(summary.phases)) lines.push(`  ${seconds(ms).padStart(11)}  ${name}`);
  lines.push('\nCost buckets across all phases (disjoint, not additional lifecycle time):');
  for (const [name, ms] of Object.entries(summary.categories).sort((a, b) => b[1] - a[1])) {
    lines.push(`  ${seconds(ms).padStart(11)}  ${(100 * ms / data.elapsedMs).toFixed(1).padStart(5)}%  ${name}`);
  }
  lines.push(`\nModules: ${summary.uniqueModules} unique, ${summary.moduleExecutions} executions (${summary.moduleExecutions - summary.uniqueModules} repeats)`);
  lines.push(`Actual transformer.process: ${summary.transformProcessCalls} calls across ${summary.transformedFiles} files (${summary.transformedDependencyFiles} dependency files)`);
  lines.push(`Matcher calls: ${summary.matcherCalls} | resetModules calls: ${data.events.filter((event) => event.name === 'resetModules').length}`);
  for (const category of ['transformer process', 'transformer cache key', 'module execution/loading']) {
    lines.push(`\nTop ${category}: inclusive / self seconds (inclusive rows overlap):`);
    const rows = data.rows.filter((row) => row.category === category).sort((a, b) => b.inclusiveMs - a.inclusiveMs);
    for (const row of rows.slice(0, 12)) lines.push(`  ${(row.inclusiveMs / 1000).toFixed(3).padStart(8)} / ${(row.selfMs / 1000).toFixed(3).padStart(7)}  x${row.calls}  ${row.label}`);
  }
  lines.push('\nTop module self time (nested measured work excluded):');
  for (const row of data.rows.filter((row) => row.category === 'module execution/loading').sort((a, b) => b.selfMs - a.selfMs).slice(0, 10)) {
    lines.push(`  ${seconds(row.selfMs).padStart(11)}  x${row.calls}  ${row.label}`);
  }
  lines.push('\nMost repeated modules:');
  for (const [file, row] of Object.entries(data.modules).filter(([, row]) => row.executions > 1).sort((a, b) => b[1].executions - a[1].executions).slice(0, 10)) {
    lines.push(`  x${row.executions}  ${file}`);
  }
  lines.push('\nSlowest test bodies (hooks excluded):');
  for (const event of data.events.filter((event) => event.name === 'test body result').sort((a, b) => b.durationMs - a.durationMs).slice(0, 12)) {
    lines.push(`  ${seconds(event.durationMs).padStart(11)}  ${event.failed ? 'FAIL' : 'PASS'}  ${event.test}`);
  }
  lines.push('\nSlowest hooks:');
  for (const event of data.events.filter((event) => event.name === 'hook result').sort((a, b) => b.durationMs - a.durationMs).slice(0, 5)) {
    lines.push(`  ${seconds(event.durationMs).padStart(11)}  ${event.failed ? 'FAIL' : 'PASS'}  ${event.hookName ?? 'hook'}`);
  }
  return { summary, text: lines.join('\n') + '\n' };
}

function summarizeCpu(profile, data) {
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const start = data.events.find((event) => event.name === 'run_start')?.time ?? Infinity;
  const end = data.events.find((event) => event.name === 'run_finish')?.time ?? Infinity;
  const phases = {};
  let timestamp = profile.startTime;
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const delta = profile.timeDeltas[i];
    timestamp += delta;
    const time = (timestamp - data.clockOriginUs) / 1000;
    const phase = time < start ? 'startup/imports' : time < end ? 'tests/hooks' : 'teardown/report';
    const frame = nodes.get(profile.samples[i]).callFrame;
    const key = `${frame.functionName || '<anonymous>'} (${frame.url || '<native>'}:${frame.lineNumber + 1})`;
    const counts = phases[phase] ??= new Map();
    counts.set(key, (counts.get(key) ?? 0) + delta / 1000);
  }
  return Object.fromEntries(Object.entries(phases).map(([phase, counts]) => [phase, {
    sampledMs: sum([...counts.values()]),
    topSelf: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([frame, ms]) => ({ frame, ms })),
  }]));
}

function formatCpu(summary) {
  const lines = ['\nCPU profile: sampled self time by phase (4 ms sampling; includes idle/GC samples, not OS CPU accounting).'];
  for (const [phase, { sampledMs, topSelf }] of Object.entries(summary)) {
    lines.push(`\n${phase}: ${seconds(sampledMs)} sampled`);
    for (const { frame, ms } of topSelf) lines.push(`  ${seconds(ms).padStart(11)}  ${frame}`);
  }
  return lines.join('\n') + '\n';
}

module.exports = { summarize, formatReport, summarizeCpu, formatCpu };
