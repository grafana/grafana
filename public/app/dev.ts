import app from './app';

/*
Import theme CSS based on env vars, e.g.: `env GRAFANA_THEME=light yarn start`
*/
declare var GRAFANA_THEME: any;
require('../sass/grafana.' + GRAFANA_THEME + '.scss');

app.init();
