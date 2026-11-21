import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { signalLabels } from '../../dataSources';
import { type Note } from '../liveScenario';

interface Props {
  notes: Note[];
}

// What could not be measured waits behind an icon, so a missing number is never read as a zero and the page keeps
// its space for the data. The Tooltip makes the icon focusable, so the reasons also open from the keyboard.
export function NotMeasuredNotice({ notes }: Props) {
  const styles = useStyles2(getStyles);
  const labels = signalLabels();
  const title = t('drilldown-real.notes.title', 'Not measured');

  // With nothing missing there is nothing to warn about.
  if (notes.length === 0) {
    return null;
  }

  return (
    <Tooltip
      placement="bottom-end"
      content={
        <div>
          <strong>{title}</strong>
          <ul className={styles.list}>
            {notes.map((note) => (
              <li key={`${note.source}-${note.message}`}>
                {labels[note.source]}: {note.message}
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <Icon name="exclamation-triangle" aria-label={title} className={styles.icon} />
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  icon: css({
    // The header aligns its actions to the top, so the icon is lowered to sit level with the title.
    marginTop: theme.spacing(1),
    color: theme.colors.warning.text,
  }),
  list: css({
    margin: 0,
    paddingLeft: theme.spacing(2),
  }),
});
