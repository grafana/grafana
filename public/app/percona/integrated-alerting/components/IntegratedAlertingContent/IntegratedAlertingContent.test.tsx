import { dataQa } from '@percona/platform-core';
import { shallow, ShallowWrapper } from 'enzyme';
import React from 'react';
import { act } from 'react-dom/test-utils';

import { Spinner } from '@grafana/ui';
import { EmptyBlock } from 'app/percona/shared/components/Elements/EmptyBlock';

import { IntegratedAlertingContent } from './IntegratedAlertingContent';

describe('IntegratedAlertingContent', () => {
  describe('IA disabled', () => {
    it('should display empty block', async () => {
      const Dummy = () => <span></span>;
      let wrapper: ShallowWrapper;

      await act(async () => {
        wrapper = await shallow(
          <IntegratedAlertingContent alertingEnabled={false} loadingSettings={false}>
            <Dummy />
          </IntegratedAlertingContent>
        );
      });
      expect(wrapper.find(Dummy).exists()).toBeFalsy();
      expect(wrapper.find(EmptyBlock).exists()).toBeTruthy();
    });

    it('should display a loading state while pending', async () => {
      let wrapper: ShallowWrapper;

      await act(async () => {
        wrapper = await shallow(<IntegratedAlertingContent alertingEnabled={false} loadingSettings={true} />);
      });
      expect(wrapper.find(Spinner).exists()).toBeTruthy();
    });

    it('should display a link to settings when loading is done', async () => {
      let wrapper: ShallowWrapper;

      await act(async () => {
        wrapper = await shallow(<IntegratedAlertingContent alertingEnabled={false} loadingSettings={false} />);
      });
      expect(wrapper.find(dataQa('ia-settings-link')).exists()).toBeTruthy();
    });
  });

  describe('IA enabled', () => {
    it('should render children', async () => {
      const Dummy = () => <span></span>;

      let wrapper: ShallowWrapper;

      await act(async () => {
        wrapper = await shallow(
          <IntegratedAlertingContent alertingEnabled={true} loadingSettings={false}>
            <Dummy />
          </IntegratedAlertingContent>
        );
      });

      expect(wrapper.find(Dummy).exists()).toBeTruthy();
    });
  });
});
