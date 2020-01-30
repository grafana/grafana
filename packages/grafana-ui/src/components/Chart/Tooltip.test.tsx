import React from 'react';
import { mount } from 'enzyme';
import { Tooltip } from './Tooltip';

// Tooltip container has padding of 8px, let's assume target tooltip has measured width & height of 100px
const content = <div style={{ width: '84px', height: '84' }} />;

describe('Chart Tooltip', () => {
  describe('is positioned correctly', () => {
    beforeEach(() => {
      // jsdom does not perform actual DOM rendering
      // We need to mock getBoundingClientRect to return what DOM would actually return
      // when measuring tooltip container (wrapper with padding and content inside)
      Element.prototype.getBoundingClientRect = jest.fn(() => {
        return { width: 100, height: 100, top: 0, left: 0, bottom: 0, right: 0 } as DOMRect;
      });
    });

    // Jest's default viewport size is 1024x768px
    test('when fits into the viewport', () => {
      const tooltip = mount(<Tooltip content={content} position={{ x: 0, y: 0 }} />);
      const container = tooltip.find('TooltipContainer > div');
      const styleAttribute = container.getDOMNode().getAttribute('style');

      // +------+
      // |origin|
      // +------+--------------+
      //        |   Tooltip    |
      //        |              |
      //        +--------------+
      expect(styleAttribute).toContain('translate3d(0px, 0px, 0)');
    });

    test("when overflows viewport's x axis", () => {
      const tooltip = mount(<Tooltip content={content} position={{ x: 1000, y: 0 }} />);
      const container = tooltip.find('TooltipContainer > div');
      const styleAttribute = container.getDOMNode().getAttribute('style');

      // We expect tooltip to flip over left side of the origin position
      //                +------+
      //                |origin|
      // +--------------+------+
      // |   Tooltip    |
      // |              |
      // +--------------+
      expect(styleAttribute).toContain('translate3d(900px, 0px, 0)');
    });

    test("when overflows viewport's y axis", () => {
      const tooltip = mount(<Tooltip content={content} position={{ x: 0, y: 700 }} />);
      const container = tooltip.find('TooltipContainer > div');
      const styleAttribute = container.getDOMNode().getAttribute('style');

      // We expect tooltip to flip over top side of the origin position
      //        +--------------+
      //        |   Tooltip    |
      //        |              |
      // +------+--------------+
      // |origin|
      // +------+
      expect(styleAttribute).toContain('translate3d(0px, 600px, 0)');
    });

    test("when overflows viewport's x and y axes", () => {
      const tooltip = mount(<Tooltip content={content} position={{ x: 1000, y: 700 }} />);
      const container = tooltip.find('TooltipContainer > div');
      const styleAttribute = container.getDOMNode().getAttribute('style');

      // We expect tooltip to flip over the left top corner of the origin position
      // +--------------+
      // |   Tooltip    |
      // |              |
      // +--------------+------+
      //                |origin|
      //                +------+
      expect(styleAttribute).toContain('translate3d(900px, 600px, 0)');
    });

    describe('when offset provided', () => {
      test("when overflows viewport's x and y axes", () => {
        const tooltip = mount(<Tooltip content={content} position={{ x: 1000, y: 700 }} offset={{ x: 10, y: 10 }} />);
        const container = tooltip.find('TooltipContainer > div');
        const styleAttribute = container.getDOMNode().getAttribute('style');

        // We expect tooltip to flip over the left top corner of the origin position with offset applied
        // +--------------------+
        // |                    |
        // |  +--------------+  |
        // |  |   Tooltip    |  |
        // |  |              |  |
        // |  +--------------+  |
        // |              offset|
        // +--------------------++------+
        //                       |origin|
        //                       +------+
        expect(styleAttribute).toContain('translate3d(890px, 590px, 0)');
      });
    });
  });
});
