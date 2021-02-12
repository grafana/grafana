#!/usr/bin/env bash

COMMIT_HASH=$(git log -n 1 | grep -Po "(?<=commit )[0-9a-z]{40}")
BENCH_FILE="tmp/bench_${COMMIT_HASH::7}.txt"
BENCH_GRAPH="tmp/bench_${COMMIT_HASH::7}.html"

# Run benchmark
go test -benchmem -run=^$ -bench . github.com/grafana/grafana/pkg/services/rbac | tee ${BENCH_FILE}

CHART_DATA=$(cat ${BENCH_FILE} |
  grep -oP "^Benchmark([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+[0-9]+" |
  sed -E 's/Benchmark([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+([0-9]+)/\1 \2/' |
  sed -E 's/^[[:alpha:]]+[0-9]+_([0-9]+)-[0-9]+[[:blank:]]+(.*)/\1 \2/' |
  sed -E 's/([^[:blank:]]+)[[:blank:]]+([^[:blank:]]+)/\[\1, \2],\n/'
)

HTML_CHART="<html>
  <head>
    <script type='text/javascript' src='https://www.gstatic.com/charts/loader.js'></script>
    <script type='text/javascript'>
      google.charts.load('current', {'packages':['corechart']});
      google.charts.setOnLoadCallback(drawChart);

      function drawChart() {
        var data = google.visualization.arrayToDataTable([
          ['case', 'time'],
          ${CHART_DATA}
        ]);

        var options = {
          title: 'Policies Performance',
          legend: 'none',
          vAxis: {
            title: 'Execution time (ns)',
            minValue: 0,
          },
          hAxis: {
            title: 'Number of users',
            minValue: 0,
          },
          trendlines: { 0: {
            type: 'polynomial',
            degree: 3,
            color: 'purple',
            lineWidth: 10,
            opacity: 0.2,
          } }
        };

        var chart = new google.visualization.ScatterChart(document.getElementById('curve_chart'));

        chart.draw(data, options);
      }
    </script>
  </head>
  <body>
    <div id='curve_chart' style='width: 900px; height: 500px'></div>
  </body>
</html>
"

echo ${HTML_CHART} | tee ${BENCH_GRAPH}
