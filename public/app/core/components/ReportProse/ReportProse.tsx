import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { renderReportMarkdown } from './renderReportMarkdown';
import { getReportProseStyles } from './styles';

interface Props {
  markdown?: string;
  className?: string;
  id?: string;
  'data-testid'?: string;
}

/** Authored, static report prose. The same renderer serves edit preview and view. */
export function ReportProse({ markdown, className, id, 'data-testid': testId }: Props) {
  const styles = useStyles2(getStyles);
  const html = useMemo(() => renderReportMarkdown(markdown), [markdown]);

  if (!html) {
    return null;
  }

  return (
    <div
      id={id}
      className={cx(styles.prose, className)}
      data-testid={testId}
      // Output is restricted to an allowlist of inline and block tags by renderReportMarkdown.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  prose: css(getReportProseStyles(theme)),
});
