import { useEffect, useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { VariableValueOption } from '@grafana/scenes';
import { Button, Stack } from '@grafana/ui';

import { VariableStaticOptionsFormItem } from './VariableStaticOptionsFormItemEditor';
import { VariableStaticOptionsFormItems } from './VariableStaticOptionsFormItems';

interface VariableStaticOptionsFormProps {
  options: VariableValueOption[];
  onChange: (options: VariableValueOption[]) => void;

  allowEmptyValue?: boolean;
  width?: number;
}

export function VariableStaticOptionsForm({
  options,
  onChange,
  allowEmptyValue,
  width,
}: VariableStaticOptionsFormProps) {
  // Whenever the form is updated, we want to ignore the next update from the parent component.
  // This is because the parent component will update the options, and we don't want to update the items again.
  // This is a hack to prevent the form from updating twice and losing items and IDs.
  // Alternatively, we could maintain a list of emitted items and compare the new options to it, but this is less performant.
  const ignoreNextUpdate = useRef<boolean>(false);

  const createEmptyItem: () => VariableStaticOptionsFormItem = () => {
    return {
      label: '',
      value: '',
      id: uuidv4(),
    };
  };

  const [items, setItems] = useState<VariableStaticOptionsFormItem[]>(
    options.length
      ? options.map((option) => ({
          label: option.label,
          value: String(option.value),
          id: uuidv4(),
        }))
      : [createEmptyItem()]
  );

  useEffect(() => {
    if (!ignoreNextUpdate.current) {
      setItems(
        options.length
          ? options.map((option) => ({
              label: option.label,
              value: String(option.value),
              id: uuidv4(),
            }))
          : [createEmptyItem()]
      );
    }

    ignoreNextUpdate.current = false;
  }, [options]);

  const updateItems = (items: VariableStaticOptionsFormItem[]) => {
    setItems(items);
    ignoreNextUpdate.current = true;
    onChange(
      items.reduce<VariableValueOption[]>((acc, item) => {
        const value = item.value.trim();

        if (!allowEmptyValue && !value) {
          return acc;
        }

        const label = item.label.trim();

        if (!label && !value) {
          return acc;
        }

        acc.push({
          label: label ? label : value,
          value,
        });

        return acc;
      }, [])
    );
  };

  const handleAdd = () => setItems([...items, createEmptyItem()]);

  return (
    <Stack direction="column" gap={2} width={width}>
      <VariableStaticOptionsFormItems items={items} onChange={updateItems} width={width} />
      <div>
        <Button
          icon="plus"
          variant="secondary"
          onClick={handleAdd}
          data-testid={
            selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsAddButton
          }
          aria-label={t('variables.query-variable-static-options.add-option-button-label', 'Add option')}
        >
          <Trans i18nKey="variables.query-variable-static-options.add-option-button-label">Add option</Trans>
        </Button>
      </div>
    </Stack>
  );
}
