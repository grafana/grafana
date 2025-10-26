import { DataQuery } from '@grafana/data';
import { Button, FilterPill, Modal, Stack } from '@grafana/ui';
import { testIds } from '../../testIds';
import { ReactElement, useState } from 'react';
import { selectQuery } from '../../utils/utils';

type Props = {
  targets: DataQuery[] | undefined;
  onDismiss?: () => void;
};

export function QueryModal(props: Props): ReactElement {
  const { targets = [], onDismiss } = props;
  const [selected, setSelected] = useState(targets[0]);

  return (
    <div data-testid={testIds.modal.container}>
      <p>Please select the query you would like to use to create &quot;something&quot; in the plugin.</p>
      <Stack>
        {targets.map((query) => (
          <FilterPill
            key={query.refId}
            label={query.refId}
            selected={query.refId === selected?.refId}
            onClick={() => setSelected(query)}
          />
        ))}
      </Stack>
      <Modal.ButtonRow>
        <Button variant="secondary" fill="outline" onClick={onDismiss}>
          Cancel
        </Button>
        <Button
          disabled={!Boolean(selected)}
          onClick={() => {
            onDismiss?.();
            selectQuery(selected);
          }}
        >
          OK
        </Button>
      </Modal.ButtonRow>
    </div>
  );
}
