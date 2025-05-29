import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

export function CheatSheet() {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <h2>
        <Trans i18nKey="cheat-sheet.title">MSSQL cheat sheet</Trans>
      </h2>
      <Trans i18nKey="cheat-sheet.time-series">Time series:</Trans>
      <ul className={styles.ulPadding}>
        <li>
          <Trans i18nKey="cheat-sheet.time-series-tip">
            return column named time (in UTC), as a unix time stamp or any sql native date data type. You can use the
            macros below.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="cheat-sheet.time-series-tip-2">
            any other columns returned will be the time point values.
          </Trans>
        </li>
      </ul>
      <Trans i18nKey="cheat-sheet.optional">Optional:</Trans>
      <ul className={styles.ulPadding}>
        <li>
          <Trans i18nKey="cheat-sheet.optional-tip" values={{ columnName: 'metric' }}>
            return column named <i>{'{{columnName}}'}</i> to represent the series name.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="cheat-sheet.optional-tip-2" values={{ columnName: 'metric' }}>
            If multiple value columns are returned the {'{{columnName}}'} column is used as prefix.
          </Trans>
        </li>
        <li>
          <Trans i18nKey="cheat-sheet.optional-tip-3" values={{ columnName: 'metric' }}>
            If no column named {'{{columnName}}'} is found the column name of the value column is used as series name
          </Trans>
        </li>
      </ul>
      <p>
        <Trans i18nKey="cheat-sheet.resultsets-time-sorted">
          Resultsets of time series queries need to be sorted by time.
        </Trans>
      </p>
      <Trans i18nKey="cheat-sheet.table">Table:</Trans>
      <ul className={styles.ulPadding}>
        <li>
          <Trans i18nKey="cheat-sheet.table-tip">return any set of columns</Trans>
        </li>
      </ul>
      <Trans i18nKey="cheat-sheet.macros">Macros:</Trans>
      {/* eslint-disable @grafana/i18n/no-untranslated-strings */}
      <ul className={styles.ulPadding}>
        <li>$__time(column) -&gt; column AS time</li>
        <li>$__timeEpoch(column) -&gt; DATEDIFF(second, &apos;1970-01-01&apos;, column) AS time</li>
        <li>
          $__timeFilter(column) -&gt; column BETWEEN &apos;2017-04-21T05:01:17Z&apos; AND
          &apos;2017-04-21T05:01:17Z&apos;
        </li>
        <li>$__unixEpochFilter(column) -&gt; column &gt;= 1492750877 AND column &lt;= 1492750877</li>
        <li>
          $__unixEpochNanoFilter(column) -&gt; column &gt;= 1494410783152415214 AND column &lt;= 1494497183142514872
        </li>
        <li>
          $__timeGroup(column, &apos;5m&apos;[, fillvalue]) -&gt; CAST(ROUND(DATEDIFF(second, &apos;1970-01-01&apos;,
          column)/300.0, 0) as bigint)*300{' '}
          <Trans i18nKey="cheat-sheet.fillvalue" values={{ null: 'NULL', previous: 'previous' }}>
            by setting fillvalue Grafana will fill in missing values according to the interval. fillvalue can be either
            a literal value, {'{{null}}'} or {'{{previous}}'}; {'{{previous}}'} will fill in the previous seen value or{' '}
            {'{{null}}'} if none has been seen yet
          </Trans>
        </li>
        <li>
          $__timeGroupAlias(column, &apos;5m&apos;[, fillvalue]) -&gt; CAST(ROUND(DATEDIFF(second,
          &apos;1970-01-01&apos;, column)/300.0, 0) as bigint)*300 AS [time]
        </li>
        <li>$__unixEpochGroup(column,&apos;5m&apos;) -&gt; FLOOR(column/300)*300</li>
        <li>$__unixEpochGroupAlias(column,&apos;5m&apos;) -&gt; FLOOR(column/300)*300 AS [time]</li>
      </ul>
      {/* eslint-enable @grafana/i18n/no-untranslated-strings */}
      <p>
        <Trans i18nKey="cheat-sheet.example-time-group" values={{ timeGroupMacro: '$__timeGroup' }}>
          Example of group by and order by with {'{{timeGroupMacro}}'}:
        </Trans>
      </p>
      {/* eslint-disable @grafana/i18n/no-untranslated-strings */}
      <pre>
        <code>
          SELECT $__timeGroup(date_time_col, &apos;1h&apos;) AS time, sum(value) as value <br />
          FROM yourtable
          <br />
          GROUP BY $__timeGroup(date_time_col, &apos;1h&apos;)
          <br />
          ORDER BY 1
          <br />
        </code>
      </pre>
      {/* eslint-enable @grafana/i18n/no-untranslated-strings */}
      <Trans i18nKey="cheat-sheet.condtional-macros">
        Or build your own conditionals using these macros which just return the values:
      </Trans>
      {/* eslint-disable @grafana/i18n/no-untranslated-strings */}
      <ul className={styles.ulPadding}>
        <li>$__timeFrom() -&gt; &apos;2017-04-21T05:01:17Z&apos;</li>
        <li>$__timeTo() -&gt; &apos;2017-04-21T05:01:17Z&apos;</li>
        <li>$__unixEpochFrom() -&gt; 1492750877</li>
        <li>$__unixEpochTo() -&gt; 1492750877</li>
        <li>$__unixEpochNanoFrom() -&gt; 1494410783152415214</li>
        <li>$__unixEpochNanoTo() -&gt; 1494497183142514872</li>
      </ul>
      {/* eslint-enable @grafana/i18n/no-untranslated-strings */}
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
