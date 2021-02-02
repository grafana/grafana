import React from 'react';
import { cloneDeep } from 'lodash';
import { DocsId, SelectableValue } from '@grafana/data';
import { Container, FeatureInfoBox, fieldMatchersUI, useTheme, ValuePicker } from '@grafana/ui';
import { OverrideEditor } from './OverrideEditor';
import { selectors } from '@grafana/e2e-selectors';
import { css } from 'emotion';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { Props } from './types';

/**
 * Expects the container div to have size set and will fill it 100%
 */
export const OverrideFieldConfigEditor: React.FC<Props> = (props) => {
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
              onChange={(value) => onOverrideChange(i, value)}
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
          label="Add an override for"
          variant="secondary"
          options={fieldMatchersUI
            .list()
            .filter((o) => !o.excludeFromPicker)
            .map<SelectableValue<string>>((i) => ({ label: i.name, value: i.id, description: i.description }))}
          onChange={(value) => onOverrideAdd(value)}
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
          url={getDocsLink(DocsId.FieldConfigOverrides)}
          className={css`
            margin: ${theme.spacing.md};
          `}
        >
          Field override rules give you a fine grained control over how your data is displayed.
        </FeatureInfoBox>
      )}

      {renderOverrides()}
      {renderAddOverride()}
    </div>
  );
};
