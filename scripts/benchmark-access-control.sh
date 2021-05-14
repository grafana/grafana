#!/usr/bin/env bash

COMMIT_HASH=$(git log -n 1 | grep -Po "(?<=commit )[0-9a-z]{40}")
COMMIT_HASH=${COMMIT_HASH::7}
BENCH_FILE="tmp/bench_${COMMIT_HASH}.txt"
BENCH_GRAPH="tmp/bench_${COMMIT_HASH}.html"

# Run benchmark
go test -benchmem -run=^$ -bench . github.com/grafana/grafana/pkg/services/accesscontrol/database | tee "${BENCH_FILE}"

CHART_DATA_USERS=$(grep -oP "^BenchmarkRolesUsers([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+[0-9]+" "${BENCH_FILE}" |
  sed -E 's/Benchmark([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+([0-9]+)/\1 \2/' |
  sed -E 's/^[[:alpha:]]+([0-9]+)_([0-9]+)-[0-9]+[[:blank:]]+(.*)/\2 \3/' |
  sed -E 's/([^[:blank:]]+)[[:blank:]]+([^[:blank:]]+)/\[\1, \2],\n/'
)

CHART_DATA_ROLES=$(grep -oP "^BenchmarkRolesPerUser([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+[0-9]+" "${BENCH_FILE}" |
  sed -E 's/Benchmark([^[:blank:]]+)[[:blank:]]+[0-9]+[[:blank:]]+([0-9]+)/\1 \2/' |
  sed -E 's/^[[:alpha:]]+([0-9]+)_([0-9]+)-[0-9]+[[:blank:]]+(.*)/\1 \3/' |
  sed -E 's/([^[:blank:]]+)[[:blank:]]+([^[:blank:]]+)/\[\1, \2],\n/'
)

HTML_CHART="<html>
  <head>
    <script type='text/javascript' src='https://www.gstatic.com/charts/loader.js'></script>
    <script type='text/javascript'>
      google.charts.load('current', {'packages':['corechart']});
      google.charts.setOnLoadCallback(drawChart);

      function drawChart() {
        var dataUsers = google.visualization.arrayToDataTable([
          ['case', 'time'],
          ${CHART_DATA_USERS}
        ]);

        var dataPolicies = google.visualization.arrayToDataTable([
          ['case', 'time'],
          ${CHART_DATA_ROLES}
        ]);

        var options = {
          title: 'Roles Performance (commit ${COMMIT_HASH})',
          legend: 'none',
          vAxis: {
            title: 'Execution time (ns)',
            minValue: 0,
          },
          hAxis: {
            title: 'Number of users',
            minValue: 0,
          },
          trendlines: {
            0: {
              type: 'polynomial',
              degree: 3,
              color: 'purple',
              lineWidth: 10,
              opacity: 0.2,
            },
          }
        };

        var chartUsers = new google.visualization.ScatterChart(document.getElementById('chart_users'));
        var chartPolicies = new google.visualization.ScatterChart(document.getElementById('chart_policies'));

        chartUsers.draw(dataUsers, options);

        var chartPoliciesOptions = options;
        chartPoliciesOptions.hAxis.title = 'Number of policies per user';
        chartPoliciesOptions.trendlines[0].color = 'red';
        chartPolicies.draw(dataPolicies, options);
      }
    </script>
  </head>
  <body>
    <div style='display: flex'>
      <div id='chart_users' style='width: 900px; height: 500px'></div>
      <div id='chart_policies' style='width: 900px; height: 500px'></div>
    </div>
  </body>
</html>
"

echo "${HTML_CHART}" | tee "${BENCH_GRAPH}"
