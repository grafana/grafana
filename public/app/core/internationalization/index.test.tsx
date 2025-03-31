import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import { PluginContextProvider, PluginMeta, PluginType } from '@grafana/data';
import { Trans as PluginTrans, setTransComponent, setUseTranslateHook, useTranslate } from '@grafana/runtime/unstable';

import { getI18next, Trans, useTranslateInternal } from './index';

const id = 'frontend-test-languages-plugin';
const mockedMeta: PluginMeta = {
  id,
  name: 'Frontend Test Languages Plugin',
  type: PluginType.panel,
  info: {
    author: { name: 'Test Author' },
    description: 'Test Description',
    links: [],
    logos: {
      large: 'test-plugin-large-logo',
      small: 'test-plugin-small-logo',
    },
    screenshots: [],
    version: '1.0.0',
    updated: '2021-01-01',
  },
  module: 'test-plugin',
  baseUrl: 'test-plugin',
};

const DummyUseTranslateComponent = () => {
  const t = useTranslate();
  return <div>{t('frontendtests.test-key', 'test-key not found')}</div>;
};

describe('internationalization', () => {
  describe('Trans component', () => {
    it('should interpolate strings without escaping dangerous characters', () => {
      const name = '<script></script>';
      const { getByText } = render(<Trans i18nKey="explore.table.title-with-name">Table - {{ name }}</Trans>);

      expect(getByText('Table - <script></script>')).toBeInTheDocument();
    });

    it('should escape dangerous characters when shouldUnescape is false', () => {
      const name = '<script></script>';
      const { getByText } = render(
        <Trans i18nKey="explore.table.title-with-name" shouldUnescape={false}>
          Table - {{ name }}
        </Trans>
      );

      expect(getByText('Table - &lt;script&gt;&lt;&#x2F;script&gt;')).toBeInTheDocument();
    });
  });
  describe('for plugins', () => {
    beforeEach(() => {
      getI18next().addResourceBundle('en', id, { 'frontendtests.test-key': 'test-value' }, undefined, true);
      setTransComponent(Trans);
      setUseTranslateHook(useTranslateInternal);
    });

    it('should return the correct value when using Trans component within a plugin context', async () => {
      const { getByText, queryByText } = render(
        <I18nextProvider i18n={getI18next()}>
          <PluginContextProvider meta={mockedMeta}>
            <PluginTrans i18nKey="frontendtests.test-key" defaults="test-key not found" />
          </PluginContextProvider>
        </I18nextProvider>
      );

      expect(getByText('test-value')).toBeInTheDocument();
      expect(queryByText('test-key not found')).not.toBeInTheDocument();
    });

    it('should return the correct value when using Trans component without a plugin context', async () => {
      const { getByText, queryByText } = render(
        <I18nextProvider i18n={getI18next()}>
          <PluginTrans i18nKey="frontendtests.test-key" defaults="test-key not found" />
        </I18nextProvider>
      );

      expect(getByText('test-key not found')).toBeInTheDocument();
      expect(queryByText('test-value')).not.toBeInTheDocument();
    });

    it('should return the correct value when using useTranslate hook within a plugin context', async () => {
      const { getByText, queryByText } = render(
        <I18nextProvider i18n={getI18next()}>
          <PluginContextProvider meta={mockedMeta}>
            <DummyUseTranslateComponent />
          </PluginContextProvider>
        </I18nextProvider>
      );

      expect(getByText('test-value')).toBeInTheDocument();
      expect(queryByText('test-key not found')).not.toBeInTheDocument();
    });

    it('should return the correct value when using useTranslate hook without a plugin context', async () => {
      const { getByText, queryByText } = render(
        <I18nextProvider i18n={getI18next()}>
          <DummyUseTranslateComponent />
        </I18nextProvider>
      );

      expect(getByText('test-key not found')).toBeInTheDocument();
      expect(queryByText('test-value')).not.toBeInTheDocument();
    });
  });
});
