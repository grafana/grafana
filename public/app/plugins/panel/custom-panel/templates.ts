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
// since the start of the time range. ctx mirrors Grafana's PanelProps; the drawing API, the CSS
// variables and the limits are described in the custom panel README.
const MAX_SPARKLINE_POINTS = 200;

function escapeHtml(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => escapes[c]);
}

function lastNotNull(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) {
      return values[i];
    }
  }
  return null;
}

// Frames that came from another panel through "-- Dashboard --" carry it in meta.custom. Frames of
// one source panel share a group; any other frame gets a group of its own.
function groupBySource(series) {
  const groups = [];
  const byPanel = new Map();
  for (const frame of series) {
    const custom = (frame.meta && frame.meta.custom) || {};
    const panelId = typeof custom.dashboardSourcePanelId === 'number' ? custom.dashboardSourcePanelId : null;
    if (panelId === null) {
      groups.push({ panelId, title: null, frames: [frame] });
      continue;
    }
    let group = byPanel.get(panelId);
    if (!group) {
      group = { panelId, title: custom.dashboardSourcePanelTitle || null, frames: [] };
      byPanel.set(panelId, group);
      groups.push(group);
    }
    group.frames.push(frame);
  }
  return groups;
}

// One metric per group: the first number field, with its last value as Grafana formats it
// (unit, decimals, mappings, thresholds color).
function collectMetrics(series) {
  const metrics = [];
  for (const group of groupBySource(series)) {
    let frame = null;
    let field = null;
    for (const candidate of group.frames) {
      field = candidate.fields.find((f) => f.type === 'number') || null;
      if (field) {
        frame = candidate;
        break;
      }
    }
    if (!field) {
      continue;
    }
    const display = field.state.lastNotNullDisplay;
    const last = lastNotNull(field.values);
    metrics.push({
      panelId: group.panelId,
      title: group.title || frame.name || field.state.displayName || field.name || frame.refId || '',
      field,
      last,
      text: display ? (display.prefix || '') + display.text + (display.suffix || '') : last == null ? '–' : String(last),
      color: (display && display.color) || 'var(--gf-color-text-primary)',
    });
  }
  return metrics;
}

function formatTime(ms, timeZone) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(ms);
}

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

panel.onRender(({ root, data, timeRange, timeZone }) => {
  const metrics = collectMetrics(data.series);
  const header =
    '<header class="range">' + escapeHtml(formatTime(timeRange.from, timeZone)) + ' – ' +
    escapeHtml(formatTime(timeRange.to, timeZone)) + '</header>';

  if (metrics.length === 0) {
    const message = data.state === 'Loading' ? 'Loading…' : 'No data to show';
    root.innerHTML = STYLE + header + '<p class="empty">' + escapeHtml(message) + '</p>';
    return;
  }

  let up = 0;
  const cards = metrics.map((metric) => {
    const { field, color } = metric;
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
      '<span class="value" style="color:' + escapeHtml(color) + '">' + escapeHtml(metric.text) + '</span>' +
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
// A metric is critical when its absolute thresholds have more than one step and its last value is
// at or above the last step. The dashboard variable "incident_mode" ("on" / "off"), read from the
// URL, forces the mode. ctx mirrors Grafana's PanelProps; see the custom panel README.

function escapeHtml(value) {
  const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => escapes[c]);
}

function lastNotNull(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) {
      return values[i];
    }
  }
  return null;
}

// Frames that came from another panel through "-- Dashboard --" carry it in meta.custom. Frames of
// one source panel share a group; any other frame gets a group of its own.
function groupBySource(series) {
  const groups = [];
  const byPanel = new Map();
  for (const frame of series) {
    const custom = (frame.meta && frame.meta.custom) || {};
    const panelId = typeof custom.dashboardSourcePanelId === 'number' ? custom.dashboardSourcePanelId : null;
    if (panelId === null) {
      groups.push({ panelId, title: null, frames: [frame] });
      continue;
    }
    let group = byPanel.get(panelId);
    if (!group) {
      group = { panelId, title: custom.dashboardSourcePanelTitle || null, frames: [] };
      byPanel.set(panelId, group);
      groups.push(group);
    }
    group.frames.push(frame);
  }
  return groups;
}

// One metric per group: the first number field, with its last value as Grafana formats it
// (unit, decimals, mappings, thresholds color).
function collectMetrics(series) {
  const metrics = [];
  for (const group of groupBySource(series)) {
    let frame = null;
    let field = null;
    for (const candidate of group.frames) {
      field = candidate.fields.find((f) => f.type === 'number') || null;
      if (field) {
        frame = candidate;
        break;
      }
    }
    if (!field) {
      continue;
    }
    const display = field.state.lastNotNullDisplay;
    const last = lastNotNull(field.values);
    metrics.push({
      panelId: group.panelId,
      title: group.title || frame.name || field.state.displayName || field.name || frame.refId || '',
      field,
      last,
      text: display ? (display.prefix || '') + display.text + (display.suffix || '') : last == null ? '–' : String(last),
      color: (display && display.color) || 'var(--gf-color-text-primary)',
    });
  }
  return metrics;
}

function criticalLimit(field) {
  const thresholds = field.config.thresholds;
  const steps = thresholds && thresholds.mode === 'absolute' ? thresholds.steps : [];
  return steps.length > 1 ? steps[steps.length - 1].value : null;
}

// Dashboard variables are URL-synced as var-<name>.
function forcedMode(location) {
  const value = String(new URLSearchParams(location.search).get('var-incident_mode') || '').toLowerCase();
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

panel.onRender(({ root, data, location }) => {
  const metrics = collectMetrics(data.series).map((m) => {
    const limit = criticalLimit(m.field);
    const critical = typeof m.last === 'number' && typeof limit === 'number' && m.last >= limit;
    // How far past its limit the metric is, relative to the limit when that is meaningful.
    const severity = critical ? (limit > 0 ? m.last / limit : m.last - limit + 1) : 0;
    return Object.assign({}, m, { limit, critical, severity });
  });
  const critical = metrics.filter((m) => m.critical).sort((a, b) => b.severity - a.severity);
  const forced = forcedMode(location);
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
// panel.onRender(draw) runs draw(ctx) on every change of data, time range, URL, theme or size.
// ctx mirrors Grafana's PanelProps: id, title, data, timeRange, timeZone, options, fieldConfig,
// width, height, transparent, fitContent, plus root (the element to draw in) and location (the
// dashboard URL, which carries the variables). See the custom panel README for the full API.
// The code runs in a sandbox: no network, no eval, no popups. Links (<a href="#panel-2">) are
// validated by Grafana before they navigate.
panel.onRender(({ root, data }) => {
  root.textContent = data.series.length + ' frame(s), state: ' + data.state;
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
