import { Draggable } from '@hello-pangea/dnd';

import { type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
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

        if (!uiConfig) {
          return (
            <Draggable draggableId={`${config.id}`} index={i} key={`${config.id}`} isDragDisabled>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.draggableProps}>
                  <Alert
                    severity="error"
                    title={t(
                      'dashboard.transformation-operation-rows.unknown-transformation-title',
                      'Unknown transformation: {{transformationId}}',
                      { transformationId: config.transformation.id }
                    )}
                    action={
                      <Button variant="secondary" onClick={() => onRemove(i)}>
                        {t('dashboard.transformation-operation-rows.remove-transformation', 'Remove')}
                      </Button>
                    }
                  />
                </div>
              )}
            </Draggable>
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
