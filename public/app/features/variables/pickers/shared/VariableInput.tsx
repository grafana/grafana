import React, { PureComponent } from 'react';
import { trim } from 'lodash';
import { NavigationKey } from '../types';
import { getTextWidth } from 'app/core/utils/text_width';

export interface Props {
  onChange: (value: string) => void;
  onNavigate: (key: NavigationKey, clearOthers: boolean) => void;
  value: string | null;
}

export class VariableInput extends PureComponent<Props> {
  onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (NavigationKey[event.keyCode]) {
      const clearOthers = event.ctrlKey || event.metaKey || event.shiftKey;
      this.props.onNavigate(event.keyCode as NavigationKey, clearOthers);
    }
  };

  onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (this.shouldUpdateValue(event.target.value)) {
      this.props.onChange(event.target.value);
    }
  };

  private shouldUpdateValue(value: string) {
    return trim(value ?? '').length > 0 || trim(this.props.value ?? '').length > 0;
  }

  render() {
    const value = this.props.value ?? '';
    return (
      <input
        ref={instance => {
          if (instance) {
            instance.focus();
            /* Old code computed width at max(instance.width, 80), but
             * instance.width is usually incorrectly reported as 0 =>
             * in fact it was constant width == 80px, which could be
             * too small for some cases.
             *
             * 'instance.scrollWidth' is a bad estimation when there is no text
             * and when characters are being deleted - in both cases reported
             * value is a way too high. It provides good estimation only when
             * text is starting to overfill textbox.
             *
             * There is also a way to use 'ch' measurement instead of 'px', but
             * it is good only for monospace fonts, and with other fonts there are
             * characters that have 2x width compared to '0' char, and, at the
             * same time, characters, that have much smaller width.
             *
             * As a result, it is better to extract font info from element and
             * compute actual text width using canvas, add a small margin of 4px
             * for cursor and selection, and then set sensible min and max limits.
             */
            const width = getTextWidth(value, instance) + 4;
            instance.setAttribute('style', `width:${Math.min(Math.max(width, 80), 300)}px`);
          }
        }}
        type="text"
        className="gf-form-input"
        value={value}
        onChange={this.onChange}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}
