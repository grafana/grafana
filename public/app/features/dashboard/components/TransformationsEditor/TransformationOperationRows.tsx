import { type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';

import { TransformationOperationRow } from './TransformationOperationRow';
import { type TransformationData } from './TransformationsEditor';
import { type TransformationsEditorTransformation } from './types';

interface TransformationOperationRowsProps {
  data: TransformationData;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRows = ({
  data,
  onChange,
  onRemove,
  configs,
}: TransformationOperationRowsProps) => {
  return (
    <>
      {configs.map((config, i) => {
        const uiConfig = standardTransformersRegistry.getIfExists(config.transformation.id);

        // A dashboard can hold a transformation the registry does not know, for
        // instance one persisted with a malformed id. Rendering nothing leaves an
        // empty tab and editing the dashboard JSON as the only way to remove it.
        if (!uiConfig) {
          return (
            <Alert
              key={`${config.id}`}
              severity="error"
              title={t(
                'dashboard.transformation-operation-rows.title-unknown-transformation',
                'Unknown transformation: {{transformationId}}',
                { transformationId: config.transformation.id }
              )}
            >
              <Button variant="secondary" size="sm" onClick={() => onRemove(i)}>
                <Trans i18nKey="dashboard.transformation-operation-rows.remove-unknown-transformation">
                  Remove transformation
                </Trans>
              </Button>
            </Alert>
          );
        }

        return (
          <TransformationOperationRow
            index={i}
            id={`${config.id}`}
            key={`${config.id}`}
            data={data}
            configs={configs}
            uiConfig={uiConfig}
            onRemove={onRemove}
            onChange={onChange}
          />
        );
      })}
    </>
  );
};
