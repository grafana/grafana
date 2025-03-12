import { useCallback, useEffect, useState } from 'react';
import { useToggle } from 'react-use';
import { mergeMap } from 'rxjs';

import {
  DataTransformerConfig,
  TransformerRegistryItem,
  FrameMatcherID,
  DataTransformContext,
  getFrameMatchers,
  transformDataFrame,
  DataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv, reportInteraction } from '@grafana/runtime';
import { ConfirmModal } from '@grafana/ui';
import {
  QueryOperationAction,
  QueryOperationToggleAction,
} from 'app/core/components/QueryOperationRow/QueryOperationAction';
import { QueryOperationRow } from 'app/core/components/QueryOperationRow/QueryOperationRow';
import config from 'app/core/config';
import { t } from 'app/core/internationalization';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

import { TransformationEditor } from './TransformationEditor';
import { TransformationEditorHelpDisplay } from './TransformationEditorHelpDisplay';
import { TransformationFilter } from './TransformationFilter';
import { TransformationData } from './TransformationsEditor';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  data: TransformationData;
  uiConfig: TransformerRegistryItem<null>;
  configs: TransformationsEditorTransformation[];
  onRemove: (index: number) => void;
  onChange: (index: number, config: DataTransformerConfig) => void;
}

export const TransformationOperationRow = ({
  onRemove,
  index,
  id,
  data,
  configs,
  uiConfig,
  onChange,
}: TransformationOperationRowProps) => {
  const [showDeleteModal, setShowDeleteModal] = useToggle(false);
  const [showDebug, toggleShowDebug] = useToggle(false);
  const [showHelp, toggleShowHelp] = useToggle(false);
  const disabled = !!configs[index].transformation.disabled;
  const topic = configs[index].transformation.topic;
  const showFilterEditor = configs[index].transformation.filter != null || topic != null;
  const showFilterToggle = showFilterEditor || data.series.length > 0 || (data.annotations?.length ?? 0) > 0;
  const [input, setInput] = useState<DataFrame[]>([]);
  const [output, setOutput] = useState<DataFrame[]>([]);
  // output of previous transformation
  const [prevOutput, setPrevOutput] = useState<DataFrame[]>([]);

  const onDisableToggle = useCallback(
    (index: number) => {
      const current = configs[index].transformation;
      onChange(index, {
        ...current,
        disabled: current.disabled ? undefined : true,
      });
    },
    [onChange, configs]
  );

  // Adds or removes the frame filter
  const toggleFilter = useCallback(() => {
    let current = { ...configs[index].transformation };
    if (current.filter) {
      delete current.filter;
    } else {
      current.filter = {
        id: FrameMatcherID.byRefId,
        options: '', // empty string will not do anything
      };
    }
    onChange(index, current);
  }, [onChange, index, configs]);

  // Instrument toggle callback
  const instrumentToggleCallback = useCallback(
    (callback: (e: React.MouseEvent) => void, toggleId: string, active: boolean | undefined) =>
      (e: React.MouseEvent) => {
        let eventName = 'panel_editor_tabs_transformations_toggle';
        if (config.featureToggles.transformationsRedesign) {
          eventName = 'transformations_redesign_' + eventName;
        }

        reportInteraction(eventName, {
          action: active ? 'off' : 'on',
          toggleId,
          transformationId: configs[index].transformation.id,
        });

        callback(e);
      },
    [configs, index]
  );

  useEffect(() => {
    const config = configs[index].transformation;
    const matcher = config.filter?.options ? getFrameMatchers(config.filter) : undefined;
    // we need previous transformation index to get its outputs
    //    to be used in this transforms inputs
    const prevTransformIndex = index - 1;

    let prevInputTransforms: Array<DataTransformerConfig<{}>> = [];
    let prevOutputTransforms: Array<DataTransformerConfig<{}>> = [];

    if (prevTransformIndex >= 0) {
      prevInputTransforms = configs.slice(0, prevTransformIndex).map((t) => t.transformation);
      prevOutputTransforms = configs.slice(prevTransformIndex, index).map((t) => t.transformation);
    }

    const inputTransforms = configs.slice(0, index).map((t) => t.transformation);
    const outputTransforms = configs.slice(index, index + 1).map((t) => t.transformation);

    const ctx: DataTransformContext = {
      interpolate: (v: string) => getTemplateSrv().replace(v),
    };

    const inputSubscription = transformDataFrame(inputTransforms, data.series, ctx).subscribe((data) => {
      if (matcher) {
        data = data.filter((frame) => matcher(frame));
      }
      setInput(data);
    });
    const outputSubscription = transformDataFrame(inputTransforms, data.series, ctx)
      .pipe(mergeMap((before) => transformDataFrame(outputTransforms, before, ctx)))
      .subscribe(setOutput);
    const prevOutputSubscription = transformDataFrame(prevInputTransforms, data.series, ctx)
      .pipe(mergeMap((before) => transformDataFrame(prevOutputTransforms, before, ctx)))
      .subscribe(setPrevOutput);

    return function unsubscribe() {
      inputSubscription.unsubscribe();
      outputSubscription.unsubscribe();
      prevOutputSubscription.unsubscribe();
    };
  }, [index, data, configs]);

  const renderActions = () => {
    return (
      <>
        {uiConfig.state && <PluginStateInfo state={uiConfig.state} />}
        <QueryOperationToggleAction
          title={t(
            'dashboard.transformation-operation-row.render-actions.title-show-transform-help',
            'Show transform help'
          )}
          icon="info-circle"
          // `instrumentToggleCallback` expects a function that takes a MouseEvent, is unused in the state setter. Instead, we simply toggle the state.
          onClick={instrumentToggleCallback(toggleShowHelp, 'help', showHelp)}
          active={showHelp}
        />
        {showFilterToggle && (
          <QueryOperationToggleAction
            title={t('dashboard.transformation-operation-row.render-actions.title-filter', 'Filter')}
            icon="filter"
            onClick={instrumentToggleCallback(toggleFilter, 'filter', showFilterEditor)}
            active={showFilterEditor}
          />
        )}
        <QueryOperationToggleAction
          title={t('dashboard.transformation-operation-row.render-actions.title-debug', 'Debug')}
          icon="bug"
          onClick={instrumentToggleCallback(toggleShowDebug, 'debug', showDebug)}
          active={showDebug}
        />
        <QueryOperationToggleAction
          title={t(
            'dashboard.transformation-operation-row.render-actions.title-disable-transformation',
            'Disable transformation'
          )}
          icon={disabled ? 'eye-slash' : 'eye'}
          onClick={instrumentToggleCallback(() => onDisableToggle(index), 'disabled', disabled)}
          active={disabled}
          dataTestId={selectors.components.Transforms.disableTransformationButton}
        />
        <QueryOperationAction
          title={t('dashboard.transformation-operation-row.render-actions.title-remove', 'Remove')}
          icon="trash-alt"
          onClick={() => (config.featureToggles.transformationsRedesign ? setShowDeleteModal(true) : onRemove(index))}
        />

        {config.featureToggles.transformationsRedesign && (
          <ConfirmModal
            isOpen={showDeleteModal}
            title={`Delete ${uiConfig.name}?`}
            body="Note that removing one transformation may break others. If there is only a single transformation, you will go back to the main selection screen."
            confirmText="Delete"
            onConfirm={() => {
              setShowDeleteModal(false);
              onRemove(index);
            }}
            onDismiss={() => setShowDeleteModal(false)}
          />
        )}
      </>
    );
  };

  return (
    <>
      <QueryOperationRow
        id={id}
        index={index}
        title={`${index + 1} - ${uiConfig.name}`}
        draggable
        actions={renderActions}
        disabled={disabled}
        expanderMessages={{
          close: 'Collapse transformation row',
          open: 'Expand transformation row',
        }}
      >
        {showFilterEditor && (
          <TransformationFilter
            data={prevOutput}
            index={index}
            config={configs[index].transformation}
            annotations={data.annotations}
            onChange={onChange}
          />
        )}

        <TransformationEditor
          input={input}
          output={output}
          debugMode={showDebug}
          index={index}
          configs={configs}
          uiConfig={uiConfig}
          onChange={onChange}
          toggleShowDebug={toggleShowDebug}
        />
      </QueryOperationRow>
      <TransformationEditorHelpDisplay transformer={uiConfig} isOpen={showHelp} onCloseClick={toggleShowHelp} />
    </>
  );
};
