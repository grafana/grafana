import React from 'react';
import { QueryOperationRow } from './QueryOperationRow';
import { mount, shallow } from 'enzyme';
import { act } from 'react-dom/test-utils';

describe('QueryOperationRow', () => {
  it('renders', () => {
    expect(() =>
      shallow(
        <QueryOperationRow id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      )
    ).not.toThrow();
  });

  describe('callbacks', () => {
    it('should not call onOpen when component is shallowed', async () => {
      const onOpenSpy = jest.fn();
      // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
      await act(async () => {
        shallow(
          <QueryOperationRow onOpen={onOpenSpy} id="test-id" index={0}>
            <div>Test</div>
          </QueryOperationRow>
        );
      });
      expect(onOpenSpy).not.toBeCalled();
    });

    it('should call onOpen when row is opened and onClose when row is collapsed', async () => {
      const onOpenSpy = jest.fn();
      const onCloseSpy = jest.fn();
      const wrapper = mount(
        <QueryOperationRow title="title" onOpen={onOpenSpy} onClose={onCloseSpy} isOpen={false} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );
      const titleEl = wrapper.find({ 'aria-label': 'Query operation row title' });
      expect(titleEl).toHaveLength(1);

      // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
      await act(async () => {
        // open
        titleEl.first().simulate('click');
      });

      // @ts-ignore strict null error, you shouldn't use promise like approach with act but I don't know what the intention is here
      await act(async () => {
        // close
        titleEl.first().simulate('click');
      });

      expect(onOpenSpy).toBeCalledTimes(1);
      expect(onCloseSpy).toBeCalledTimes(1);
    });
  });

  describe('headerElement rendering', () => {
    it('should render headerElement provided as element', () => {
      const title = <div aria-label="test title">Test</div>;
      const wrapper = shallow(
        <QueryOperationRow headerElement={title} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      const titleEl = wrapper.find({ 'aria-label': 'test title' });
      expect(titleEl).toHaveLength(1);
    });

    it('should render headerElement provided as function', () => {
      const title = () => <div aria-label="test title">Test</div>;
      const wrapper = shallow(
        <QueryOperationRow headerElement={title} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      const titleEl = wrapper.find({ 'aria-label': 'test title' });
      expect(titleEl).toHaveLength(1);
    });

    it('should expose api to headerElement rendered as function', () => {
      const propsSpy = jest.fn();
      const title = (props: any) => {
        propsSpy(props);
        return <div aria-label="test title">Test</div>;
      };
      shallow(
        <QueryOperationRow headerElement={title} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      expect(Object.keys(propsSpy.mock.calls[0][0])).toContain('isOpen');
    });
  });

  describe('actions rendering', () => {
    it('should render actions provided as element', () => {
      const actions = <div aria-label="test actions">Test</div>;
      const wrapper = shallow(
        <QueryOperationRow actions={actions} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      const actionsEl = wrapper.find({ 'aria-label': 'test actions' });
      expect(actionsEl).toHaveLength(1);
    });
    it('should render actions provided as function', () => {
      const actions = () => <div aria-label="test actions">Test</div>;
      const wrapper = shallow(
        <QueryOperationRow actions={actions} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      const actionsEl = wrapper.find({ 'aria-label': 'test actions' });
      expect(actionsEl).toHaveLength(1);
    });

    it('should expose api to title rendered as function', () => {
      const propsSpy = jest.fn();
      const actions = (props: any) => {
        propsSpy(props);
        return <div aria-label="test actions">Test</div>;
      };
      shallow(
        <QueryOperationRow actions={actions} id="test-id" index={0}>
          <div>Test</div>
        </QueryOperationRow>
      );

      expect(Object.keys(propsSpy.mock.calls[0][0])).toEqual(['isOpen', 'onOpen', 'onClose']);
    });
  });
});
