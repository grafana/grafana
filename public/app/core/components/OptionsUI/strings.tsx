import { css } from '@emotion/css';
import React from 'react';

import { FieldConfigEditorProps, StringFieldConfigSettings, GrafanaTheme2 } from '@grafana/data';
import { config } from '@grafana/runtime';
import { stylesFactory, Button, Icon, Input } from '@grafana/ui';

type Props = FieldConfigEditorProps<string[], StringFieldConfigSettings>;
interface State {
  showAdd: boolean;
}

export class StringArrayEditor extends React.PureComponent<Props, State> {
  state = {
    showAdd: false,
  };

  onRemoveString = (index: number) => {
    const { value, onChange } = this.props;
    const copy = [...value];
    copy.splice(index, 1);
    onChange(copy);
  };

  onValueChange = (e: React.KeyboardEvent<HTMLInputElement> | React.FocusEvent<HTMLInputElement>, idx: number) => {
    if ('key' in e) {
      if (e.key !== 'Enter') {
        return;
      }
    }
    const { value, onChange } = this.props;

    // Form event, or Enter
    const v = e.currentTarget.value.trim();
    if (idx < 0) {
      if (v) {
        e.currentTarget.value = ''; // reset last value
        onChange([...value, v]);
      }
      this.setState({ showAdd: false });
      return;
    }

    if (!v) {
      return this.onRemoveString(idx);
    }

    const copy = [...value];
    copy[idx] = v;
    onChange(copy);
  };

  render() {
    const { value, item } = this.props;
    const { showAdd } = this.state;
    const styles = getStyles(config.theme2);
    const placeholder = item.settings?.placeholder || 'Add text';
    return (
      <div>
        {value.map((v, index) => {
          return (
            <Input
              className={styles.textInput}
              key={`${index}/${v}`}
              defaultValue={v || ''}
              onBlur={(e) => this.onValueChange(e, index)}
              onKeyDown={(e) => this.onValueChange(e, index)}
              suffix={<Icon className={styles.trashIcon} name="trash-alt" onClick={() => this.onRemoveString(index)} />}
            />
          );
        })}

        {showAdd ? (
          <Input
            autoFocus
            className={styles.textInput}
            placeholder={placeholder}
            defaultValue={''}
            onBlur={(e) => this.onValueChange(e, -1)}
            onKeyDown={(e) => this.onValueChange(e, -1)}
            suffix={<Icon name="plus-circle" />}
          />
        ) : (
          <Button icon="plus" size="sm" variant="secondary" onClick={() => this.setState({ showAdd: true })}>
            {placeholder}
          </Button>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    textInput: css`
      margin-bottom: 5px;
      &:hover {
        border: 1px solid ${theme.components.input.borderHover};
      }
    `,
    trashIcon: css`
      color: ${theme.colors.text.secondary};
      cursor: pointer;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});
