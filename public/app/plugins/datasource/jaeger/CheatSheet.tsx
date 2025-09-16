import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { TextLink, useStyles2 } from '@grafana/ui';

export default function CheatSheet() {
  const styles = useStyles2(getStyles);
  return (
    <>
      <h2 id="jaeger-cheat-sheet">Jaeger Cheat Sheet</h2>
      <p>
        This cheat sheet provides a quick overview of the query types that are available. For more details about the
        Jaeger data source, check out{' '}
        <TextLink href="https://grafana.com/docs/grafana/latest/datasources/jaeger" external>
          the documentation
        </TextLink>
        .
      </p>

      <hr />
      <ul className={styles.unorderedList}>
        <li>
          Search - filter traces by service name. Addtionally, you can filter by tags or min/max duration, as well as
          limit the number of traces that are returned.
        </li>
        <li>TraceID - if you have a trace ID, simply enter the trace ID to see the trace.</li>
        <li>
          JSON File - you can upload a JSON file that contains a single trace to visualize it. If the file has multiple
          traces then the first trace is used for visualization. An example of a valid JSON file can be found in{' '}
          <TextLink href="https://grafana.com/docs/grafana/latest/datasources/jaeger/#upload-json-trace-file" external>
            this section
          </TextLink>{' '}
          of the documentation.
        </li>
      </ul>
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  unorderedList: css({
    listStyleType: 'none',
  }),
});
