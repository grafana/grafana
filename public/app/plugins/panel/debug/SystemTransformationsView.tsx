import { useEffect } from 'react';

import { type PanelProps, ReducerID } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { usePanelContext } from '@grafana/ui';

import { type Options } from './panelcfg.gen';

type Props = PanelProps<Options>;

/**
 * Example of panel provided (system) transformations. The panel prepends a limit transformation and
 * appends a reduce transformation around whatever transformations the user configured. They show up
 * as read-only rows in the panel editor transformations tab and are never persisted to the dashboard.
 */
export function SystemTransformationsView({ data }: Props) {
  const { onSetSystemTransformations } = usePanelContext();

  useEffect(() => {
    if (!onSetSystemTransformations) {
      return;
    }

    onSetSystemTransformations({
      prepend: [{ id: 'limit', options: { limitField: 100 } }],
      append: [{ id: 'reduce', options: { reducers: [ReducerID.mean] } }],
    });

    // Clear the system transformations when the mode changes or the panel unmounts
    return () => onSetSystemTransformations({});
  }, [onSetSystemTransformations]);

  return (
    <div>
      <p>
        <Trans i18nKey="debug.system-transformations-view.description">
          This mode prepends a limit transformation and appends a reduce transformation to the user configured ones.
          Open the transformations tab in the panel editor to see them as read-only rows.
        </Trans>
      </p>
      <ul>
        {data.series.map((frame, index) => {
          const name = frame.refId ?? frame.name ?? String(index);
          const fieldCount = frame.fields.length;
          const rowCount = frame.length;

          return (
            <li key={index}>
              <Trans i18nKey="debug.system-transformations-view.frame-summary">
                {{ name }}: {{ fieldCount }} fields, {{ rowCount }} rows
              </Trans>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
