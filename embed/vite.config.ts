import path from 'node:path';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(__dirname, '..');
const shim = (name: string) => path.resolve(__dirname, `src/shims/${name}`);

/**
 * Importer-scoped shims: relative specifiers that a plain alias would over-match.
 */
function importerScopedShims() {
  return {
    name: 'embed-importer-shims',
    enforce: 'pre' as const,
    resolveId(source: string, importer: string | undefined) {
      // Panel-type suggestions are an in-app editing feature; the chain reaches app/api.
      if (source === './suggestions' && importer?.includes('plugins/panel/')) {
        return shim('panel-suggestions.ts');
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [importerScopedShims()],
  esbuild: { jsx: 'automatic' },
  resolve: {
    // In-repo @grafana/* packages expose their TS sources under this export condition.
    conditions: ['@grafana-app/source', 'module', 'browser', 'development|production'],
    alias: [
      // The real config module reads window.grafanaBootData at import time and throws standalone.
      { find: /^@grafana\/runtime$/, replacement: shim('grafana-runtime.tsx') },
      // Field actions reach app/features/actions -> @grafana/runtime -> half of app core.
      // Suffix match: TimeSeriesTooltip imports this relatively.
      { find: /^(?:.*\/)?status-history\/utils$/, replacement: shim('status-history-utils.ts') },
      // Annotations are dashboard-app context; an embedded panel renders none.
      { find: /^(?:.*\/)?plugins\/AnnotationsPlugin$/, replacement: shim('annotations-plugin.tsx') },
      { find: /^app\/features\/dashboard\/services\/DashboardSrv$/, replacement: shim('dashboard-srv.ts') },
      // Assistant context reaches @grafana/assistant -> api-clients -> alerting worker.
      {
        find: /^app\/core\/components\/AssistantTooltip\/buildAssistantContext$/,
        replacement: shim('assistant-tooltip-context.ts'),
      },
      {
        find: /^app\/core\/components\/AssistantTooltip\/AssistantTooltipButton$/,
        replacement: shim('assistant-tooltip-button.tsx'),
      },
      // Ad hoc filtering is a dashboard affordance gated on a runtime feature flag.
      { find: /^app\/features\/panel\/filters\/adhoc$/, replacement: shim('panel-filters-adhoc.ts') },
      // Everything else under app/ resolves into the real source tree.
      { find: /^app\/(.*)$/, replacement: path.resolve(repoRoot, 'public/app') + '/$1' },
      // grafana-ui imports uPlot's CSS as a side effect (components/uPlot/Plot.tsx),
      // which vite would extract into a stylesheet the host must link. The embed
      // adopts the same CSS into the shadow root instead (?inline, so this exact
      // specifier does not match), so the side-effect copy is dropped.
      {
        find: /^uplot\/dist\/uPlot\.min\.css$/,
        replacement: path.resolve(__dirname, 'src/styles/uplot-side-effect.css'),
      },
      // Webpack-era asset prefixes used by app-core sources.
      { find: /^img\/(.*)$/, replacement: path.resolve(repoRoot, 'public/img') + '/$1' },
      { find: /^fonts\/(.*)$/, replacement: path.resolve(repoRoot, 'public/fonts') + '/$1' },
    ],
  },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'GrafanaEmbed',
      // iife: plain <script> consumers. es: bundler consumers (the MCP app).
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'es' ? 'grafana-embed.mjs' : 'grafana-embed.js'),
    },
    outDir: 'dist',
    sourcemap: false,
    minify: true,
    cssCodeSplit: false,
  },
});
