import { css } from '@emotion/css';
import { ReactElement } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { LibraryPanel } from '@grafana/schema';
import { Field, useStyles2 } from '@grafana/ui';

import { LibraryPanelCard } from '../../../library-panels/components/LibraryPanelCard/LibraryPanelCard';
import { LibraryPanelInput, LibraryPanelInputState } from '../types';

interface Props {
  inputs: LibraryPanelInput[];
  label: string;
  description: string;
  folderName?: string;
}

export function LibraryPanelsList({ inputs, label, description, folderName }: Props): ReactElement | null {
  const styles = useStyles2(getStyles);

  if (!Boolean(inputs?.length)) {
    return null;
  }

  return (
    <div className={styles.spacer}>
      <Field label={label} description={description} noMargin>
        <>
          {inputs.map((input, index) => {
            const libraryPanelIndex = `elements[${index}]`;
            const libraryPanel: LibraryPanel =
              input.state === LibraryPanelInputState.New
                ? { ...input.model, meta: { ...input.model.meta, folderName: folderName ?? 'Dashboards' } }
                : { ...input.model };

            return (
              <div className={styles.item} key={libraryPanelIndex}>
                <LibraryPanelCard libraryPanel={libraryPanel} onClick={() => undefined} />
              </div>
            );
          })}
        </>
      </Field>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    spacer: css({
      marginBottom: theme.spacing(2),
    }),
    item: css({
      marginBottom: theme.spacing(1),
    }),
  };
}
