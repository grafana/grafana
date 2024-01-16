// TODO: Vite has no require.context support yet. Attempt at a workaround below.
// let templates = (require as any).context('../', true, /\.html$/);
// templates.keys().forEach((key: string) => {
//   templates(key);
// });

// See vite.config.ts angularHtmlImport function for the code that _should_ assist with these templates.

import 'app/angular/panel/partials/query_editor_row.html';
import 'app/angular/partials/http_settings_next.html';
import 'app/angular/partials/tls_auth_settings.html';
import 'app/features/admin/partials/admin_home.html';
import 'app/features/admin/partials/edit_org.html';
import 'app/features/admin/partials/stats.html';
import 'app/features/admin/partials/styleguide.html';
import 'app/features/alerting/partials/alert_tab.html';
import 'app/features/annotations/partials/event_editor.html';
import 'app/partials/confirm_modal.html';
import 'app/partials/modal.html';
import 'app/partials/reset_password.html';
import 'app/partials/signup_invited.html';
import 'app/plugins/panel/graph/axes_editor.html';
import 'app/plugins/panel/graph/tab_display.html';
import 'app/plugins/panel/graph/tab_legend.html';
import 'app/plugins/panel/graph/tab_series_overrides.html';
import 'app/plugins/panel/graph/tab_thresholds.html';
import 'app/plugins/panel/graph/tab_time_regions.html';
import 'app/plugins/panel/graph/thresholds_form.html';
import 'app/plugins/panel/graph/time_regions_form.html';
import 'app/plugins/panel/heatmap/partials/axes_editor.html';
import 'app/plugins/panel/heatmap/partials/display_editor.html';
import 'app/plugins/panel/table-old/column_options.html';
import 'app/plugins/panel/table-old/editor.html';
import 'app/plugins/panel/table-old/module.html';
