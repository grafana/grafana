import React, { useCallback } from 'react';
import { useToggle } from 'react-use';

import {
  DataFrame,
  DataTransformerConfig,
  TransformerRegistryItem,
  FrameMatcherID,
  // renderMarkdown,
} from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ConfirmModal, HorizontalGroup, Modal } from '@grafana/ui';
// import { OperationRowHelp } from 'app/core/components/QueryOperationRow/OperationRowHelp';
import {
  QueryOperationAction,
  QueryOperationToggleAction,
} from 'app/core/components/QueryOperationRow/QueryOperationAction';
import {
  QueryOperationRow,
  QueryOperationRowRenderProps,
} from 'app/core/components/QueryOperationRow/QueryOperationRow';
import config from 'app/core/config';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

// import { CalculateFieldHelper } from './HelperContent/CalculateFieldHelper';
import { TransformationEditor } from './TransformationEditor';
import { TransformationEditorHelperModal } from './TransformationEditorHelperModal';
import { TransformationFilter } from './TransformationFilter';
import { TransformationsEditorTransformation } from './types';

interface TransformationOperationRowProps {
  id: string;
  index: number;
  data: DataFrame[];
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
  console.log(id, 'id');
  const [showDeleteModal, setShowDeleteModal] = useToggle(false);
  const [showDebug, toggleShowDebug] = useToggle(false);
  const [showHelp, toggleShowHelp] = useToggle(false);
  // const [showInfoModal, toggleShowModal] = useToggle(true);
  const disabled = !!configs[index].transformation.disabled;
  const filter = configs[index].transformation.filter != null;
  const showFilter = filter || data.length > 1;

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

  // const toggleExpand = useCallback(() => {
  //   if (showHelp) {
  //     return true;
  //   }

  //   // We return `undefined` here since the QueryOperationRow component ignores an `undefined` value for the `isOpen` prop.
  //   // If we returned `false` here, the row would be collapsed when the user toggles off `showHelp`, which is not what we want.
  //   return undefined;
  // }, [showHelp]);

  // const getHelpContent = () => CalculateFieldHelper();

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

  const renderActions = ({ isOpen }: QueryOperationRowRenderProps) => {
    return (
      <HorizontalGroup align="center" width="auto">
        {uiConfig.state && <PluginStateInfo state={uiConfig.state} />}
        <QueryOperationToggleAction
          title="Show transform help"
          icon="info-circle"
          // `instrumentToggleCallback` expects a function that takes a MouseEvent, is unused in the state setter. Instead, we simply toggle the state.
          onClick={instrumentToggleCallback(toggleShowHelp, 'help', showHelp)}
          active={showHelp}
        />
        {showFilter && (
          <QueryOperationToggleAction
            title="Filter"
            icon="filter"
            onClick={instrumentToggleCallback(toggleFilter, 'filter', filter)}
            active={filter}
          />
        )}
        <QueryOperationToggleAction
          title="Debug"
          disabled={!isOpen}
          icon="bug"
          onClick={instrumentToggleCallback(toggleShowDebug, 'debug', showDebug)}
          active={showDebug}
        />
        <QueryOperationToggleAction
          title="Disable transformation"
          icon={disabled ? 'eye-slash' : 'eye'}
          onClick={instrumentToggleCallback(() => onDisableToggle(index), 'disabled', disabled)}
          active={disabled}
        />
        <QueryOperationAction
          title="Remove"
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
        <TransformationEditorHelperModal contentType="" isOpen={showHelp} onCloseClick={toggleShowHelp} />
        {/* <Modal
          title="Transformation help"
          isOpen={showHelp}
          onClickBackdrop={toggleShowHelp}
          onDismiss={toggleShowHelp}
        >
          {getHelpContent()}
        </Modal> */}
      </HorizontalGroup>
    );
  };

  return (
    <QueryOperationRow
      id={id}
      index={index}
      title={uiConfig.name}
      draggable
      actions={renderActions}
      disabled={disabled}
      // isOpen={toggleExpand()}
      // Assure that showHelp is untoggled when the row becomes collapsed.
      // onClose={() => toggleShowHelp(false)}
    >
      {/* {showHelp && <OperationRowHelp markdown={prepMarkdown(uiConfig)} />} */}
      {filter && (
        <TransformationFilter index={index} config={configs[index].transformation} data={data} onChange={onChange} />
      )}
      <TransformationEditor
        debugMode={showDebug}
        index={index}
        data={data}
        configs={configs}
        uiConfig={uiConfig}
        onChange={onChange}
      />
    </QueryOperationRow>
  );
};

// function markdownHelper(markdown: string) {
//   const helpHtml = renderMarkdown(markdown);
//   return <div className="markdown-html" dangerouslySetInnerHTML={{ __html: helpHtml }} />;
// }

// function prepMarkdown(uiConfig: TransformerRegistryItem<null>) {
//   let helpMarkdown = uiConfig.help ?? uiConfig.description;

//   return `
// ${helpMarkdown}

// Go the <a href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana" target="_blank" rel="noreferrer">
// transformation documentation
// </a> for more.
// `;
// }

// function prepMarkdown(uiConfig: TransformerRegistryItem<null>) {
//   let helpMarkdown = uiConfig.help ?? uiConfig.description;
//   // JEV: does help exist on most of these??? If not, we should build them out...

//   return `
// ${helpMarkdown}

// <ul>
//   <li><strong>Field</strong> - Select from available fields</li>
//   <li><strong>as</strong> - Select the FieldType to convert to</li>
//     <ul>
//       <li><strong>Numeric</strong> - attempts to make the values numbers</li>
//       <li><strong>String</strong> - will make the values strings</li>
//       <li><strong>Boolean</strong> - will make the values booleans</li>
//       <li><strong>Time</strong> - attempts to parse the values as time</li>
//         <ul>
//           <li>Will show an option to specify a DateFormat as input by a string like yyyy-mm-dd or DD MM YYYY hh:mm:ss</li>
//         </ul>
//     </ul>
// </ul>
// `;
// }
