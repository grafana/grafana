import React from 'react';

export const AnnotationsHelp = () => {
  return (
    <div className="gf-form grafana-info-box alert-info">
      <div>
        <h5>Annotation Query Format</h5>
        <p>
          An annotation is an event that is overlaid on top of graphs. Annotation rendering is expensive so it is
          important to limit the number of rows returned.{' '}
        </p>
        <p>
          The Title and Text fields support templating and can use data returned from the query. For example, the Title
          field could have the following text:
        </p>
        <code>
          {`${'{{metric.type}}'}`} has value: {`${'{{metric.value}}'}`}
        </code>
        <p>
          Example Result: <code>monitoring.googleapis.com/uptime_check/http_status has this value: 502</code>
        </p>
        <span>Patterns:</span>
        <p>
          <code>{`${'{{metric.value}}'}`}</code> = value of the metric/point
        </p>
        <p>
          <code>{`${'{{metric.type}}'}`}</code> = metric type e.g. compute.googleapis.com/instance/cpu/usage_time
        </p>
        <p>
          <code>{`${'{{metric.name}}'}`}</code> = name part of metric e.g. instance/cpu/usage_time
        </p>
        <p>
          <code>{`${'{{metric.service}}'}`}</code> = service part of metric e.g. compute
        </p>
        <p>
          <code>{`${'{{metric.label.label_name}}'}`}</code> = Metric label metadata e.g. metric.label.instance_name
        </p>
        <p>
          <code>{`${'{{resource.label.label_name}}'}`}</code> = Resource label metadata e.g. resource.label.zone
        </p>
      </div>
    </div>
  );
};
