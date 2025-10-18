// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/configuration/PromSettings.test.tsx
import { render, screen } from '@testing-library/react';
import { SyntheticEvent } from 'react';

import { SelectableValue } from '@grafana/data';

import { createDefaultConfigOptions } from '../test/mocks/datasource';

import { getValueFromEventItem, PromSettings } from './PromSettings';

describe('PromSettings', () => {
  describe('getValueFromEventItem', () => {
    describe('when called with undefined', () => {
      it('then it should return empty string', () => {
        const result = getValueFromEventItem(
          undefined as unknown as SyntheticEvent<HTMLInputElement> | SelectableValue<string>
        );
        expect(result).toEqual('');
      });
    });

    describe('when called with an input event', () => {
      it('then it should return value from currentTarget', () => {
        const value = 'An input value';
        const result = getValueFromEventItem({ currentTarget: { value } });
        expect(result).toEqual(value);
      });
    });

    describe('when called with a select event', () => {
      it('then it should return value', () => {
        const value = 'A select value';
        const result = getValueFromEventItem({ value });
        expect(result).toEqual(value);
      });
    });
  });

  describe('PromSettings component', () => {
    const defaultProps = createDefaultConfigOptions();

    it('should show POST httpMethod if no httpMethod', () => {
      const options = defaultProps;
      options.url = '';
      options.jsonData.httpMethod = '';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show POST httpMethod if POST httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'POST';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('POST')).toBeInTheDocument();
    });
    it('should show GET httpMethod if GET httpMethod is configured', () => {
      const options = defaultProps;
      options.url = 'test_url';
      options.jsonData.httpMethod = 'GET';

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('GET')).toBeInTheDocument();
    });

    it('should have a series endpoint configuration element', () => {
      const options = defaultProps;

      render(<PromSettings onOptionsChange={() => {}} options={options} />);
      expect(screen.getByText('Use series endpoint')).toBeInTheDocument();
    });
  });
});
