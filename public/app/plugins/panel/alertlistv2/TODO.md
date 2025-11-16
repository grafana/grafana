- Add support for rule health for Grafana managed rules
- Add support for silenced rules
  For this we will need to fetch the list of currently active silences, invert the matcher operators and use them as a filter in the PromQL expression.
