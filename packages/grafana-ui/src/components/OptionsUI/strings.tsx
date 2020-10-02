import React from 'react';
import { FieldConfigEditorProps, StringFieldConfigSettings, GrafanaTheme } from '@grafana/data';
import { Input } from '../Input/Input';
import { Icon } from '../Icon/Icon';
import { stylesFactory, getTheme } from '../../themes';
import { css } from 'emotion';
import { Button } from '../Button';

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

  onValueChange = (e: React.SyntheticEvent, idx: number) => {
    const evt = e as React.KeyboardEvent<HTMLInputElement>;
    if (e.hasOwnProperty('key')) {
      if (evt.key !== 'Enter') {
        return;
      }
    }
    const { value, onChange } = this.props;

    // Form event, or Enter
    const v = evt.currentTarget.value.trim();
    if (idx < 0) {
      if (v) {
        evt.currentTarget.value = ''; // reset last value
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
    const styles = getStyles(getTheme());
    const placeholder = item.settings?.placeholder || 'Add text';
    return (
      <div>
        {value.map((v, index) => {
          return (
            <Input
              className={styles.textInput}
              key={`${index}/${v}`}
              defaultValue={v || ''}
              onBlur={e => this.onValueChange(e, index)}
              onKeyDown={e => this.onValueChange(e, index)}
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
            onBlur={e => this.onValueChange(e, -1)}
            onKeyDown={e => this.onValueChange(e, -1)}
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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    textInput: css`
      margin-bottom: 5px;
      &:hover {
        border: 1px solid ${theme.colors.formInputBorderHover};
      }
    `,
    trashIcon: css`
      color: ${theme.colors.textWeak};
      cursor: pointer;

      &:hover {
        color: ${theme.colors.text};
      }
    `,
  };
});
