import React from 'react';
import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';
import { AsyncSelectNG, SelectNG } from './SelectNG';
import { generateOptions } from '../Select/mockOptions';
import { SelectableValue } from '@grafana/data';
import { boolean } from '@storybook/addon-knobs';
import { css } from 'emotion';

export default {
  title: 'Forms/SelectNG',
  component: SelectNG,
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
};
interface LoadAsyncOptionsOpts {
  error?: boolean;
  noOptions?: boolean;
  timeout?: number;
}
const getLoadAsyncOptions = ({ timeout, error, noOptions }: LoadAsyncOptionsOpts) => (inputValue: string) => {
  console.log('load asyncs', inputValue);
  return new Promise<Array<SelectableValue<string>>>((resolve, reject) => {
    setTimeout(() => {
      if (error) {
        reject(new Error('Problem loading options...'));
        return;
      }

      resolve(noOptions ? [] : generateOptions(false, inputValue));
    }, timeout);
  });
};
export const basic = () => {
  return (
    <>
      <SelectNG options={generateOptions()} />
    </>
  );
};

export const async = () => {
  const error = boolean('Throw loading error', false);
  const noOptions = boolean('Return no options', false);
  return (
    <>
      <AsyncSelectNG
        loadOptions={getLoadAsyncOptions({ timeout: 2000, error, noOptions })}
        noOptionsMessage="no options found"
      />
    </>
  );
};

export const positioning = () => {
  return (
    <>
      <div
        className={css`
          width: 500px;
          height: 500px;
          overflow-y: scroll;
          overscroll-behavior: contain;
          background: red;
          display: flex;
          justify-content: center;
          position: relative;
        `}
      >
        <div className={css`width: 200px; &:before{ content: ''; width: 1px; display: block; height: 600px;} &:after{ content: ''; width: 1px; display: block; height: 600px;}`}><SelectNG options={generateOptions()} /></div>
      </div>
    </>
  );
};
