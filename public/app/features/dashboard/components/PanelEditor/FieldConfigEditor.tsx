import React, { useCallback } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import {
  DataFrame,
  FeatureState,
  FieldConfigPropertyItem,
  FieldConfigSource,
  PanelPlugin,
  SelectableValue,
  VariableSuggestionsScope,
} from '@grafana/data';
import { Container, Counter, FeatureInfoBox, Field, fieldMatchersUI, Label, useTheme, ValuePicker } from '@grafana/ui';
import { getDataLinksVariableSuggestions } from '../../../panel/panellinks/link_srv';
import { OverrideEditor } from './OverrideEditor';
import groupBy from 'lodash/groupBy';
import { OptionsGroup } from './OptionsGroup';
import { selectors } from '@grafana/e2e-selectors';
import { css } from 'emotion';

interface Props {
  plugin: PanelPlugin;
  config: FieldConfigSource;
  onChange: (config: FieldConfigSource) => void;
  /* Helpful for IntelliSense */
  data: DataFrame[];
}

/**
 * Expects the container div to have size set and will fill it 100%
 */
export const OverrideFieldConfigEditor: React.FC<Props> = props => {
  const theme = useTheme();
  const { config } = props;
  const onOverrideChange = (index: number, override: any) => {
    const { config } = props;
    let overrides = cloneDeep(config.overrides);
    overrides[index] = override;
    props.onChange({ ...config, overrides });
  };

  const onOverrideRemove = (overrideIndex: number) => {
    const { config } = props;
    let overrides = cloneDeep(config.overrides);
    overrides.splice(overrideIndex, 1);
    props.onChange({ ...config, overrides });
  };

  const onOverrideAdd = (value: SelectableValue<string>) => {
    const { onChange, config } = props;
    onChange({
      ...config,
      overrides: [
        ...config.overrides,
        {
          matcher: {
            id: value.value!,
          },
          properties: [],
        },
      ],
    });
  };

  const renderOverrides = () => {
    const { config, data, plugin } = props;
    const { fieldConfigRegistry } = plugin;

    if (config.overrides.length === 0) {
      return null;
    }

    return (
      <div>
        {config.overrides.map((o, i) => {
          // TODO:  apply matcher to retrieve fields
          return (
            <OverrideEditor
              name={`Override ${i + 1}`}
              key={`${o.matcher.id}/${i}`}
              data={data}
              override={o}
              onChange={value => onOverrideChange(i, value)}
              onRemove={() => onOverrideRemove(i)}
              registry={fieldConfigRegistry}
            />
          );
        })}
      </div>
    );
  };

  const renderAddOverride = () => {
    return (
      <Container padding="md">
        <ValuePicker
          icon="plus"
          label="Add override"
          variant="secondary"
          options={fieldMatchersUI
            .list()
            .map<SelectableValue<string>>(i => ({ label: i.name, value: i.id, description: i.description }))}
          onChange={value => onOverrideAdd(value)}
          isFullWidth={false}
        />
      </Container>
    );
  };

  return (
    <div aria-label={selectors.components.OverridesConfigEditor.content}>
      {config.overrides.length === 0 && (
        <FeatureInfoBox
          title="Overrides"
          featureState={FeatureState.beta}
          // url={getDocsLink(DocsId.FieldConfigOverrides)}
          className={css`
            margin: ${theme.spacing.md};
          `}
        >
          Field options overrides give you a fine grained control over how your data is displayed.
        </FeatureInfoBox>
      )}

      {renderOverrides()}
      {renderAddOverride()}
    </div>
  );
};

export const DefaultFieldConfigEditor: React.FC<Props> = ({ data, onChange, config, plugin }) => {
  const setDefaultValue = useCallback(
    (name: string, value: any, custom: boolean) => {
      const defaults = { ...config.defaults };
      const remove = value === undefined || value === null || '';

      if (custom) {
        if (defaults.custom) {
          if (remove) {
            defaults.custom = { ...defaults.custom };
            delete defaults.custom[name];
          } else {
            defaults.custom = { ...defaults.custom, [name]: value };
          }
        } else if (!remove) {
          defaults.custom = { [name]: value };
        }
      } else if (remove) {
        delete (defaults as any)[name];
      } else {
        (defaults as any)[name] = value;
      }

      onChange({
        ...config,
        defaults,
      });
    },
    [config, onChange]
  );

  const renderEditor = useCallback(
    (item: FieldConfigPropertyItem, categoryItemCount: number) => {
      if (item.isCustom && item.showIf && !item.showIf(config.defaults.custom)) {
        return null;
      }

      const defaults = config.defaults;
      const value = item.isCustom
        ? defaults.custom
          ? defaults.custom[item.path]
          : undefined
        : (defaults as any)[item.path];

      const label = (
        <Label description={item.description} category={item.category?.slice(1)}>
          {item.name}
        </Label>
      );

      return (
        <Field label={label} key={`${item.id}/${item.isCustom}`}>
          <item.editor
            item={item}
            value={value}
            onChange={v => setDefaultValue(item.path, v, item.isCustom)}
            context={{
              data,
              getSuggestions: (scope?: VariableSuggestionsScope) => getDataLinksVariableSuggestions(data, scope),
            }}
          />
        </Field>
      );
    },
    [config]
  );

  const groupedConfigs = groupBy(plugin.fieldConfigRegistry.list(), i => i.category && i.category[0]);

  return (
    <div aria-label={selectors.components.FieldConfigEditor.content}>
      {Object.keys(groupedConfigs).map((k, i) => {
        const groupItemsCounter = countGroupItems(groupedConfigs[k], config);

        return (
          <OptionsGroup
            renderTitle={isExpanded => {
              return (
                <>
                  {k} {!isExpanded && groupItemsCounter && <Counter value={groupItemsCounter} />}
                </>
              );
            }}
            id={`${k}/${i}`}
            key={`${k}/${i}`}
          >
            {groupedConfigs[k].map(c => {
              return renderEditor(c, groupedConfigs[k].length);
            })}
          </OptionsGroup>
        );
      })}
    </div>
  );
};

const countGroupItems = (group: FieldConfigPropertyItem[], config: FieldConfigSource) => {
  let counter = 0;

  for (const item of group) {
    const value = item.isCustom
      ? config.defaults.custom
        ? config.defaults.custom[item.path]
        : undefined
      : (config.defaults as any)[item.path];
    if (item.getItemsCount && item.getItemsCount(value) > 0) {
      counter = counter + item.getItemsCount(value);
    }
  }

  return counter === 0 ? undefined : counter;
};
