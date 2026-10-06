import { t } from '@grafana/i18n';

export type StarterTemplateId = 'kpi-briefing' | 'incident-layout' | 'blank';

export interface StarterTemplate {
  id: StarterTemplateId;
  label: string;
  description: string;
  code: string;
}

// Template code runs inside the render sandbox, not in Grafana. It is plain JavaScript stored in
// the dashboard JSON, so it stays in English and is never translated. It avoids template literals
// so this file can hold it in a single TypeScript template string without escaping.

const KPI_BRIEFING_CODE = `// KPI briefing: one card per source panel with its last value, a sparkline and the change
// since the start of the time range. The drawing API (ctx fields, helpers, CSS variables, limits)
// is described in the custom panel README.
const MAX_SPARKLINE_POINTS = 200;

function sparklinePoints(values) {
  const points = values.filter((v) => typeof v === 'number');
  // Evenly spaced samples that always keep the first and the last point.
  const count = Math.min(points.length, MAX_SPARKLINE_POINTS);
  const sampled = Array.from({ length: count }, (_, i) =>
    points[count === 1 ? 0 : Math.round((i * (points.length - 1)) / (count - 1))]
  );
  if (sampled.length < 2) {
    return '';
  }
  const min = Math.min(...sampled);
  const max = Math.max(...sampled);
  const span = max - min || 1;
  return sampled
    .map((v, i) => ((i / (sampled.length - 1)) * 100).toFixed(2) + ',' + (28 - ((v - min) / span) * 26).toFixed(2))
    .join(' ');
}

function firstAndLast(values) {
  const numbers = values.filter((v) => typeof v === 'number');
  return numbers.length ? { first: numbers[0], last: numbers[numbers.length - 1] } : null;
}

function collectMetrics(helpers) {
  const metrics = [];
  for (const group of helpers.bySource()) {
    // Frames with a known source panel give one card per panel; other frames give one card each.
    const sets = group.panelId != null ? [group.frames] : group.frames.map((frame) => [frame]);
    for (const frames of sets) {
      let frame = null;
      let field = null;
      for (const candidate of frames) {
        field = helpers.field(candidate, 'number') || null;
        if (field) {
          frame = candidate;
          break;
        }
      }
      if (!field) {
        continue;
      }
      metrics.push({
        panelId: group.panelId,
        title: group.title || frame.name || field.displayName || field.name || frame.refId || '',
        field,
      });
    }
  }
  return metrics;
}

const STYLE =
  '<style>' +
  '#root{padding:var(--gf-spacing);box-sizing:border-box}' +
  '.range,.summary{color:var(--gf-color-text-secondary);margin:0 0 var(--gf-spacing)}' +
  '.empty{color:var(--gf-color-text-secondary)}' +
  '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--gf-spacing)}' +
  '.card{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--gf-color-border-weak);' +
  'border-radius:var(--gf-radius);background:var(--gf-color-bg-primary);color:inherit;text-decoration:none}' +
  'a.card:hover{border-color:var(--gf-color-border-medium)}' +
  '.title{color:var(--gf-color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
  '.value{font-size:2em;font-weight:500}' +
  '.spark{width:100%;height:30px}' +
  '.delta{font-size:0.9em;color:var(--gf-color-text-secondary)}' +
  '.delta.up{color:var(--gf-color-success)}.delta.down{color:var(--gf-color-error)}' +
  '</style>';

panel.onRender(({ root, data, timeRange, helpers }) => {
  const { escapeHtml, formatTime, last } = helpers;
  const metrics = collectMetrics(helpers);
  const header =
    '<header class="range">' + escapeHtml(formatTime(timeRange.from)) + ' – ' + escapeHtml(formatTime(timeRange.to)) + '</header>';

  if (metrics.length === 0) {
    const message = data.state === 'Loading' ? 'Loading…' : 'No data to show';
    root.innerHTML = STYLE + header + '<p class="empty">' + escapeHtml(message) + '</p>';
    return;
  }

  let up = 0;
  const cards = metrics.map((metric) => {
    const { field } = metric;
    const lastValue = last(field);
    const text = field.lastDisplay != null ? field.lastDisplay : lastValue == null ? '–' : String(lastValue);
    const color = field.lastColor || 'var(--gf-color-text-primary)';
    const ends = firstAndLast(field.values);
    let delta = '<span class="delta">–</span>';
    if (ends) {
      const change = ends.last - ends.first;
      if (change > 0) {
        up++;
      }
      const percent = ends.first !== 0 ? (change / Math.abs(ends.first)) * 100 : null;
      const label = percent == null ? (change >= 0 ? '+' : '') + change.toPrecision(3) : (percent >= 0 ? '+' : '') + percent.toFixed(1) + '%';
      const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
      const arrow = change > 0 ? '▲ ' : change < 0 ? '▼ ' : '';
      delta = '<span class="delta ' + direction + '">' + arrow + escapeHtml(label) + '</span>';
    }
    const points = sparklinePoints(field.values);
    const sparkline = points
      ? '<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="' +
        escapeHtml(color) + '" stroke-width="1.5" vector-effect="non-scaling-stroke" points="' + points + '"/></svg>'
      : '';
    const body =
      '<span class="title">' + escapeHtml(metric.title) + '</span>' +
      '<span class="value" style="color:' + escapeHtml(color) + '">' + escapeHtml(text) + '</span>' +
      sparkline + delta;
    return metric.panelId != null
      ? '<a class="card" href="#panel-' + metric.panelId + '">' + body + '</a>'
      : '<div class="card">' + body + '</div>';
  });

  const summary = up + ' of ' + metrics.length + ' metrics up since range start';
  root.innerHTML =
    STYLE + header + '<p class="summary">' + escapeHtml(summary) + '</p><div class="grid">' + cards.join('') + '</div>';
});
`;

const INCIDENT_LAYOUT_CODE = `// Incident layout: switches between a calm summary and an incident view.
// A metric is critical when its thresholds have more than one step and its last value is at or
// above the last step. The dashboard variable "incident_mode" ("on" / "off") forces the mode.
// The drawing API (ctx fields, helpers, CSS variables, limits) is described in the custom panel README.

function collectMetrics(helpers) {
  const metrics = [];
  for (const group of helpers.bySource()) {
    const sets = group.panelId != null ? [group.frames] : group.frames.map((frame) => [frame]);
    for (const frames of sets) {
      let frame = null;
      let field = null;
      for (const candidate of frames) {
        field = helpers.field(candidate, 'number') || null;
        if (field) {
          frame = candidate;
          break;
        }
      }
      if (!field) {
        continue;
      }
      const lastValue = helpers.last(field);
      const steps = field.thresholds || [];
      const limit = steps.length > 1 ? steps[steps.length - 1].value : null;
      const critical = typeof lastValue === 'number' && typeof limit === 'number' && lastValue >= limit;
      metrics.push({
        panelId: group.panelId,
        title: group.title || frame.name || field.displayName || field.name || frame.refId || '',
        text: field.lastDisplay != null ? field.lastDisplay : lastValue == null ? '–' : String(lastValue),
        color: field.lastColor || 'var(--gf-color-text-primary)',
        critical,
        limit,
        // How far past its limit the metric is, relative to the limit when that is meaningful.
        severity: critical ? (limit > 0 ? lastValue / limit : lastValue - limit + 1) : 0,
      });
    }
  }
  return metrics;
}

function forcedMode(variables) {
  const variable = variables.incident_mode;
  if (!variable) {
    return null;
  }
  const value = String(Array.isArray(variable.value) ? variable.value[0] : variable.value).toLowerCase();
  return value === 'on' || value === 'off' ? value : null;
}

function link(metric, inner, className) {
  return metric.panelId != null
    ? '<a class="' + className + '" href="#panel-' + metric.panelId + '">' + inner + '</a>'
    : '<div class="' + className + '">' + inner + '</div>';
}

const STYLE =
  '<style>' +
  '#root{padding:var(--gf-spacing);box-sizing:border-box}' +
  'a{color:inherit;text-decoration:none}' +
  '.muted{color:var(--gf-color-text-secondary)}' +
  '.banner{padding:12px 16px;border-radius:var(--gf-radius);background:var(--gf-color-error);color:#fff;font-weight:500;margin-bottom:var(--gf-spacing)}' +
  '.offenders{display:flex;flex-direction:column;gap:var(--gf-spacing)}' +
  '.offender{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:baseline;padding:8px 12px;' +
  'border:1px solid var(--gf-color-error);border-radius:var(--gf-radius)}' +
  '.offender .value{font-size:1.5em;font-weight:500}' +
  '.others{margin-top:var(--gf-spacing);color:var(--gf-color-text-secondary)}' +
  '.others ul{margin:4px 0;padding-left:20px}' +
  '.calm{color:var(--gf-color-success);font-weight:500;margin:0 0 var(--gf-spacing)}' +
  '.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--gf-spacing)}' +
  '.tile{display:flex;flex-direction:column;padding:8px;border:1px solid var(--gf-color-border-weak);border-radius:var(--gf-radius)}' +
  '.tile .name{color:var(--gf-color-text-secondary);font-size:0.85em}' +
  '.tile .value{font-size:1.25em}' +
  '</style>';

panel.onRender(({ root, data, variables, helpers }) => {
  const { escapeHtml } = helpers;
  const metrics = collectMetrics(helpers);
  const critical = metrics.filter((m) => m.critical).sort((a, b) => b.severity - a.severity);
  const forced = forcedMode(variables);
  const incident = forced ? forced === 'on' : critical.length > 0;

  if (metrics.length === 0 && !incident) {
    const message = data.state === 'Loading' ? 'Loading…' : 'No data to show';
    root.innerHTML = STYLE + '<p class="muted">' + escapeHtml(message) + '</p>';
    return;
  }

  if (incident) {
    const others = metrics.filter((m) => !m.critical);
    const headline = critical.length
      ? 'Incident: ' + critical.length + ' of ' + metrics.length + ' signals critical'
      : 'Incident mode';
    const offenders = critical
      .map((m) =>
        link(
          m,
          '<span class="name">' + escapeHtml(m.title) + '</span><span class="value" style="color:' + escapeHtml(m.color) + '">' +
            escapeHtml(m.text) + '</span><span class="muted">limit ' + escapeHtml(m.limit) + '</span>',
          'offender'
        )
      )
      .join('');
    const rest = others.length
      ? '<details class="others"><summary>' + others.length + ' other signals</summary><ul>' +
        others.map((m) => '<li>' + link(m, escapeHtml(m.title) + ': ' + escapeHtml(m.text), 'compact') + '</li>').join('') +
        '</ul></details>'
      : '';
    root.innerHTML =
      STYLE + '<div class="banner" role="alert">' + escapeHtml(headline) + '</div><div class="offenders">' + offenders + '</div>' + rest;
    return;
  }

  const tiles = metrics
    .map((m) =>
      link(m, '<span class="name">' + escapeHtml(m.title) + '</span><span class="value" style="color:' + escapeHtml(m.color) + '">' +
        escapeHtml(m.text) + '</span>', 'tile')
    )
    .join('');
  root.innerHTML =
    STYLE + '<p class="calm">All clear: ' + metrics.length + ' signals below their critical thresholds</p><div class="tiles">' + tiles + '</div>';
});
`;

const BLANK_CODE = `// Custom panel drawing code. Data comes from this panel's queries; this code only draws it.
// panel.onRender(draw) runs draw(ctx) on every data, time range, variable, theme or size change.
// ctx: root, seq, data, timeRange, timeZone, variables, theme, size, isRenderTarget, helpers.
// See the custom panel README for the full API, the CSS variables (var(--gf-...)) and the limits.
// The code runs in a sandbox: no network, no eval, no popups. Links (<a href="#panel-2">) are
// validated by Grafana before they navigate.
panel.onRender(({ root, data, helpers }) => {
  const frames = helpers.frames();
  root.textContent = frames.length + ' frame(s), state: ' + data.state;
});
`;

export function getDefaultDrawingCode(): string {
  return KPI_BRIEFING_CODE;
}

export function getBlankDrawingCode(): string {
  return BLANK_CODE;
}

export function getStarterTemplates(): StarterTemplate[] {
  return [
    {
      id: 'kpi-briefing',
      label: t('custom-panel.templates.kpi-briefing.label', 'KPI briefing'),
      description: t(
        'custom-panel.templates.kpi-briefing.description',
        'One card per source panel with the last value, a sparkline and the change over the time range'
      ),
      code: KPI_BRIEFING_CODE,
    },
    {
      id: 'incident-layout',
      label: t('custom-panel.templates.incident-layout.label', 'Incident layout'),
      description: t(
        'custom-panel.templates.incident-layout.description',
        'Switches to an incident view when a metric crosses its last threshold'
      ),
      code: INCIDENT_LAYOUT_CODE,
    },
    {
      id: 'blank',
      label: t('custom-panel.templates.blank.label', 'Blank'),
      description: t('custom-panel.templates.blank.description', 'A minimal starting point'),
      code: BLANK_CODE,
    },
  ];
}
