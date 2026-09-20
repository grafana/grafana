// Dynamic import so the query string busts the module cache; defining
// <grafana-panel> is a side effect of loading the bundle.
const { FieldType, toDataFrame } = await import(`../dist/grafana-embed.mjs?v=${Date.now()}`);

// --- fixtures -------------------------------------------------------------

const STEP_MS = 30_000;

function series(name, { base, amp, spikeAt, spikeTo, unit }) {
  const now = Date.now();
  const count = 120;
  const times = [];
  const values = [];
  for (let i = 0; i < count; i++) {
    times.push(now - (count - 1 - i) * STEP_MS);
    const wave = base + Math.sin(i / 7) * amp;
    values.push(spikeAt !== undefined && i >= spikeAt && i < spikeAt + 4 ? spikeTo : wave);
  }
  return toDataFrame({
    fields: [
      { name: 'Time', type: FieldType.time, values: times },
      { name, type: FieldType.number, values, config: unit ? { unit } : {} },
    ],
  });
}

/** Dashboard v2 panel element: the shape spec.elements stores and Notebook produces. */
function panelKind(title, { options = {}, fieldConfig = { defaults: {}, overrides: [] } } = {}) {
  return {
    kind: 'Panel',
    spec: {
      id: 1,
      title,
      links: [],
      data: { kind: 'QueryGroup', spec: { queries: [], transformations: [], queryOptions: {} } },
      vizConfig: { kind: 'VizConfig', group: 'timeseries', version: '', spec: { options, fieldConfig } },
    },
  };
}

const lineDefaults = {
  color: { mode: 'palette-classic' },
  custom: { drawStyle: 'line', lineWidth: 2, fillOpacity: 10, showPoints: 'never', spanNulls: true },
};

// --- panels ---------------------------------------------------------------

const p1 = document.getElementById('p1');
p1.panel = panelKind('Request rate', {
  fieldConfig: { defaults: { ...lineDefaults, unit: 'reqps' }, overrides: [] },
});
p1.frames = [series('frontend', { base: 120, amp: 30 }), series('backend', { base: 70, amp: 18 })];

const p2 = document.getElementById('p2');
p2.panel = panelKind('p99 latency', {
  fieldConfig: { defaults: { ...lineDefaults, unit: 's' }, overrides: [] },
});
p2.frames = [series('p99', { base: 0.4, amp: 0.15, spikeAt: 70, spikeTo: 6.2 })];

/**
 * The overrides fixture. Every one of these is silently dropped by the earlier
 * panel-embed spike, which hand-merged a fixed list of standard keys and had no
 * field config registry:
 *   - custom.axisPlacement  : a panel-type custom property
 *   - unit                  : a standard property, per field
 *   - color                 : a standard property with a non-scalar value
 */
const p3 = document.getElementById('p3');
p3.panel = panelKind('Overrides', {
  fieldConfig: {
    defaults: { ...lineDefaults, unit: 'reqps' },
    overrides: [
      {
        matcher: { id: 'byName', options: 'error ratio' },
        properties: [
          { id: 'custom.axisPlacement', value: 'right' },
          { id: 'unit', value: 'percentunit' },
          { id: 'color', value: { mode: 'fixed', fixedColor: 'red' } },
          { id: 'custom.fillOpacity', value: 0 },
        ],
      },
    ],
  },
});
p3.frames = [
  series('requests', { base: 900, amp: 180 }),
  series('error ratio', { base: 0.04, amp: 0.02, spikeAt: 70, spikeTo: 0.42 }),
];

/**
 * Control for the overrides assertion: same frames and defaults, no overrides. Kept
 * off-screen; only its pixels are compared against p3's.
 */
const pRef = document.createElement('grafana-panel');
pRef.setAttribute('height', '300');
pRef.setAttribute('from', 'now-1h');
pRef.setAttribute('to', 'now');
pRef.style.cssText = 'position:absolute;left:-9999px;top:0;width:1000px';
document.body.appendChild(pRef);
pRef.panel = panelKind('Overrides control', {
  fieldConfig: { defaults: { ...lineDefaults, unit: 'reqps' }, overrides: [] },
});
pRef.frames = [
  series('requests', { base: 900, amp: 180 }),
  series('error ratio', { base: 0.04, amp: 0.02, spikeAt: 70, spikeTo: 0.42 }),
];

const panels = [p1, p2, p3];

// --- host controls --------------------------------------------------------

function press(group, value) {
  for (const btn of document.querySelectorAll(`button[data-${group}]`)) {
    btn.setAttribute('aria-pressed', String(btn.dataset[group] === value));
  }
}

for (const btn of document.querySelectorAll('button[data-range]')) {
  btn.addEventListener('click', () => {
    const range = btn.dataset.range;
    press('range', range);
    // One host control, several panels: the whole point of living in the host DOM.
    for (const el of panels) {
      el.setAttribute('from', `now-${range}`);
      el.setAttribute('to', 'now');
    }
  });
}

for (const btn of document.querySelectorAll('button[data-palette]')) {
  btn.addEventListener('click', () => {
    const palette = btn.dataset.palette;
    press('palette', palette);
    document.body.dataset.palette = palette;
    // CSS custom properties changed; the element re-reads them on request.
    for (const el of panels) {
      el.refreshTheme();
    }
  });
}

// The panel reports user-driven zoom; the host decides what to do with it.
for (const el of panels) {
  el.addEventListener('timerangechange', (e) => {
    const { from, to } = e.detail;
    for (const other of panels) {
      other.setAttribute('from', String(Math.round(from)));
      other.setAttribute('to', String(Math.round(to)));
    }
    press('range', '');
  });
}

// --- assertions -----------------------------------------------------------

const out = document.getElementById('assert');

function check(name, pass, detail) {
  return `${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`;
}

/**
 * uPlot draws the plot and its tick labels onto canvases, so nothing about the
 * rendered result is visible to textContent or the accessibility tree. Comparing
 * canvas pixels is the only honest programmatic check that a change reached the plot.
 */
function canvasSignature(el) {
  return [...el.shadowRoot.querySelectorAll('canvas')].map((c) => c.toDataURL()).join('|');
}

const settle = (ms = 500) => new Promise((r) => setTimeout(r, ms));

/**
 * Wait for a condition rather than for a duration. A fixed sleep here was long
 * enough on a warm cache and too short on a cold one, which made the assertions
 * report a missing chart that was merely late.
 */
async function until(predicate, { timeout = 15000, interval = 50 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) {
      return true;
    }
    await settle(interval);
  }
  return false;
}

async function runAssertions() {
  const ready = await until(() => [...panels, pRef].every((el) => el.shadowRoot?.querySelector('canvas')));
  if (!ready) {
    out.textContent = check('all panels rendered a chart within 15s', false);
    return;
  }
  // One more frame so uPlot has drawn, not just mounted.
  await settle(250);
  const lines = [];
  const root = p1.shadowRoot;
  const inner = root.querySelector('div');
  const style = getComputedStyle(inner);

  lines.push(check('chart rendered', !!root.querySelector('canvas')));
  lines.push(
    check(
      'shadow root adopted stylesheets',
      (root.adoptedStyleSheets?.length ?? 0) > 0,
      `${root.adoptedStyleSheets?.length ?? 0} sheets`
    )
  );
  lines.push(
    check(
      'box-sizing is border-box despite host content-box !important',
      style.boxSizing === 'border-box',
      style.boxSizing
    )
  );
  lines.push(
    check(
      'host font stack does not leak in',
      !/comic|chalkboard|cursive/i.test(style.fontFamily),
      style.fontFamily.slice(0, 48)
    )
  );
  lines.push(check('host line-height does not leak in', parseFloat(style.lineHeight) < 30, style.lineHeight));
  lines.push(check('host colour does not leak in', style.color !== 'rgb(255, 0, 255)', style.color));

  // Legend visibility. Dead in the earlier spike, where structureRev was pinned to a
  // constant so GraphNG never rebuilt its uPlot config after a field config change.
  //
  // Asserted through the legend's own aria-label rather than canvas pixels: Grafana
  // derives that label from the *applied* field config, so it moves only if the
  // hideSeriesFrom override actually reached the data. Comparing toDataURL() on the
  // same canvas before and after proved unreliable, reporting no change for a
  // toggle that visibly worked.
  const selectionState = () =>
    [...p1.shadowRoot.querySelectorAll('[data-testid^="data-testid VizLegend series"] button')]
      .map((b) => b.getAttribute('aria-label'))
      .join(' / ');

  const legendItem = [...p1.shadowRoot.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'backend');
  if (legendItem) {
    const before = selectionState();
    legendItem.click();
    await settle();
    const afterHide = selectionState();
    legendItem.click();
    await settle();
    const afterRestore = selectionState();
    lines.push(check('legend toggle applies a visibility override', afterHide !== before, afterHide));
    lines.push(check('legend toggle is reversible', afterRestore === before, afterRestore));
  } else {
    lines.push(check('legend toggle applies a visibility override', false, 'legend item not found'));
  }

  // Overrides. A right-hand axis only exists if custom.axisPlacement applied, and the
  // same data with the overrides stripped must draw differently.
  const axes = p3.shadowRoot.querySelectorAll('.u-axis').length;
  lines.push(check('override created a second y axis', axes >= 3, `${axes} axes`));
  lines.push(
    check(
      'overridden panel draws differently from the same panel without overrides',
      canvasSignature(p3) !== canvasSignature(pRef)
    )
  );

  out.textContent = lines.join('\n');
  window.__assertions = lines;
  window.__failures = lines.filter((l) => l.startsWith('FAIL'));
}

runAssertions();
