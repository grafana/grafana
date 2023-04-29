import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export function CheatSheet() {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>MySQL cheat sheet</h2>
      Time series:
      <ul className={styles.ulPadding}>
        <li>
          return column named time or time_sec (in UTC), as a unix time stamp or any sql native date data type. You can
          use the macros below.
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
        <li>$__time(column) -&gt; UNIX_TIMESTAMP(column) as time_sec</li>
        <li>$__timeEpoch(column) -&gt; UNIX_TIMESTAMP(column) as time_sec</li>
        <li>$__timeFilter(column) -&gt; column BETWEEN FROM_UNIXTIME(1492750877) AND FROM_UNIXTIME(1492750877)</li>
        <li>$__unixEpochFilter(column) -&gt; time_unix_epoch &gt; 1492750877 AND time_unix_epoch &lt; 1492750877</li>
        <li>
          $__unixEpochNanoFilter(column) -&gt; column &gt;= 1494410783152415214 AND column &lt;= 1494497183142514872
        </li>
        <li>
          $__timeGroup(column,&apos;5m&apos;[, fillvalue]) -&gt; cast(cast(UNIX_TIMESTAMP(column)/(300) as signed)*300
          as signed) by setting fillvalue grafana will fill in missing values according to the interval fillvalue can be
          either a literal value, NULL or previous; previous will fill in the previous seen value or NULL if none has
          been seen yet
        </li>
        <li>
          $__timeGroupAlias(column,&apos;5m&apos;) -&gt; cast(cast(UNIX_TIMESTAMP(column)/(300) as signed)*300 as
          signed) AS &quot;time&quot;
        </li>
        <li>$__unixEpochGroup(column,&apos;5m&apos;) -&gt; column DIV 300 * 300</li>
        <li>$__unixEpochGroupAlias(column,&apos;5m&apos;) -&gt; column DIV 300 * 300 AS &quot;time&quot;</li>
      </ul>
      <p>Example of group by and order by with $__timeGroup:</p>
      <pre>
        <code>
          $__timeGroupAlias(timestamp_col, &apos;1h&apos;), sum(value_double) as value
          <br />
          FROM yourtable
          <br />
          GROUP BY 1<br />
          ORDER BY 1
          <br />
        </code>
      </pre>
      Or build your own conditionals using these macros which just return the values:
      <ul className={styles.ulPadding}>
        <li>$__timeFrom() -&gt; FROM_UNIXTIME(1492750877)</li>
        <li>$__timeTo() -&gt; FROM_UNIXTIME(1492750877)</li>
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
