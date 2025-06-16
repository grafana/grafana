import { forwardRef, useRef, HTMLProps } from 'react';

import { escapeStringForRegex, unEscapeStringFromRegex } from '@grafana/data';
import { Trans } from '@grafana/i18n';

import { useCombinedRefs } from '../../utils/useCombinedRefs';
import { Button } from '../Button/Button';
import { Icon } from '../Icon/Icon';
import { Input } from '../Input/Input';

export interface Props extends Omit<HTMLProps<HTMLInputElement>, 'onChange'> {
  value: string | undefined;
  width?: number;
  onChange: (value: string) => void;
  escapeRegex?: boolean;
}

export const FilterInput = forwardRef<HTMLInputElement, Props>(
  ({ value, width, onChange, escapeRegex = true, ...restProps }, ref) => {
    const innerRef = useRef<HTMLInputElement | null>(null);
    const combinedRef = useCombinedRefs<HTMLInputElement>(ref, innerRef);

    const suffix =
      value !== '' ? (
        <Button
          icon="times"
          fill="text"
          size="sm"
          onClick={(e) => {
            innerRef.current?.focus();
            onChange('');
            e.stopPropagation();
          }}
        >
          <Trans i18nKey="grafana-ui.filter-input.clear">Clear</Trans>
        </Button>
      ) : null;

    return (
      <Input
        prefix={<Icon name="search" />}
        suffix={suffix}
        width={width}
        type="text"
        value={escapeRegex ? unEscapeStringFromRegex(value ?? '') : value}
        onChange={(event) =>
          onChange(escapeRegex ? escapeStringForRegex(event.currentTarget.value) : event.currentTarget.value)
        }
        {...restProps}
        ref={combinedRef}
      />
    );
  }
);

FilterInput.displayName = 'FilterInput';
