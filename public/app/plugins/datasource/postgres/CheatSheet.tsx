import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function CheatSheet() {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>PostgreSQL cheat sheet</h2>
      Time series:
      <ul className={styles.ulPadding}>
        <li>
          return column named <i>time</i> (UTC in seconds or timestamp)
        </li>
        <li>return column(s) with numeric datatype as values</li>
      </ul>
      Optional:
      <ul className={styles.ulPadding}>
        <li>
          return column named <i>metric</i> to represent the series name.
        </li>
        <li>If multiple value columns are returned the metric column is used as prefix.</li>
        <li>If no column named metric is found the column name of the value column is used as series name</li>
      </ul>
      <p>Resultsets of time series queries need to be sorted by time.</p>
      Table:
      <ul className={styles.ulPadding}>
        <li>return any set of columns</li>
      </ul>
      Macros:
      <ul className={styles.ulPadding}>
        <li>$__time(column) -&gt; column as &quot;time&quot;</li>
        <li>$__timeEpoch -&gt; extract(epoch from column) as &quot;time&quot;</li>
        <li>
          $__timeFilter(column) -&gt; column BETWEEN &apos;2017-04-21T05:01:17Z&apos; AND
          &apos;2017-04-21T05:01:17Z&apos;
        </li>
        <li>$__unixEpochFilter(column) -&gt; column &gt;= 1492750877 AND column &lt;= 1492750877</li>
        <li>
          $__unixEpochNanoFilter(column) -&gt; column &gt;= 1494410783152415214 AND column &lt;= 1494497183142514872
        </li>
        <li>
          $__timeGroup(column,&apos;5m&apos;[, fillvalue]) -&gt; (extract(epoch from column)/300)::bigint*300 by setting
          fillvalue grafana will fill in missing values according to the interval fillvalue can be either a literal
          value, NULL or previous; previous will fill in the previous seen value or NULL if none has been seen yet
        </li>
        <li>
          $__timeGroupAlias(column,&apos;5m&apos;) -&gt; (extract(epoch from column)/300)::bigint*300 AS
          &quot;time&quot;
        </li>
        <li>$__unixEpochGroup(column,&apos;5m&apos;) -&gt; floor(column/300)*300</li>
        <li>$__unixEpochGroupAlias(column,&apos;5m&apos;) -&gt; floor(column/300)*300 AS &quot;time&quot;</li>
      </ul>
      <p>Example of group by and order by with $__timeGroup:</p>
      <pre>
        <code>
          SELECT $__timeGroup(date_time_col, &apos;1h&apos;), sum(value) as value <br />
          FROM yourtable
          <br />
          GROUP BY time
          <br />
          ORDER BY time
          <br />
        </code>
      </pre>
      Or build your own conditionals using these macros which just return the values:
      <ul className={styles.ulPadding}>
        <li>$__timeFrom() -&gt; &apos;2017-04-21T05:01:17Z&apos;</li>
        <li>$__timeTo() -&gt; &apos;2017-04-21T05:01:17Z&apos;</li>
        <li>$__unixEpochFrom() -&gt; 1492750877</li>
        <li>$__unixEpochTo() -&gt; 1492750877</li>
        <li>$__unixEpochNanoFrom() -&gt; 1494410783152415214</li>
        <li>$__unixEpochNanoTo() -&gt; 1494497183142514872</li>
      </ul>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    ulPadding: css({
      margin: theme.spacing(1, 0),
      paddingLeft: theme.spacing(5),
    }),
  };
}
