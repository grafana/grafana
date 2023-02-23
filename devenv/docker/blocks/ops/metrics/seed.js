import child_process from 'child_process';
import fs from 'fs';

const RESOLUTION = 15;
const OBSERVATIONS = 240;

class Openmetrics{
  metrics = {};

  add(metric) {
    if (metric.name in this.metrics) throw new Error("Metric name already in use:", metric.name);

    this.metrics[metric.name] = metric;
  }

  toString() {
    let res = [];
    let timestampSeconds = Math.round(Date.now() / 1000) - RESOLUTION * OBSERVATIONS;
    for (const metric of Object.values(this.metrics)) {
      res.push(`# HELP ${metric.name} ${metric.help}`);
      res.push(`# TYPE ${metric.name} ${metric.type}`);

      const measurement = metric.measurementFactory();
      
      for (let i = 0; i < OBSERVATIONS ; i++) {
        for (const [labelName, labelValues] of Object.entries(metric.labels)) {
          for (const labelValue of labelValues) {
            res.push(`${metric.name}{${labelName}="${labelValue}"} ${measurement()} ${timestampSeconds}`);
          }
        }

        timestampSeconds += RESOLUTION;
      }
    }

    res.push(`# EOF`);

    return res.join("\n");
  }
}

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const openmetrics = new Openmetrics();

openmetrics.add({
  name: "http_requests_total",
  type: "counter",
  help: "The total number of HTTP requests.",
  labels: {
    code: [200, 400, 500], 
  },
  measurementFactory() {
    let value = 0;

    return () => {
      value += getRandomInt(200);

      return value;
    }
  }
});

fs.writeFileSync("openmetrics", openmetrics.toString());

child_process.exec("promtool tsdb create-blocks-from openmetrics openmetrics /prometheus");
