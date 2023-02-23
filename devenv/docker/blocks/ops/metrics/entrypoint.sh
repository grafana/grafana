promtool tsdb create-blocks-from openmetrics openmetrics /prometheus
/bin/prometheus --config.file=/etc/prometheus/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --web.console.libraries=/usr/share/prometheus/console_libraries \
  --web.console.templates=/usr/share/prometheus/consoles&
npm install
npm start