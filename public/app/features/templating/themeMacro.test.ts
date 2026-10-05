import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { config } from '@grafana/runtime';
import { sceneGraph, SceneFlexLayout, sceneUtils } from '@grafana/scenes';

import { ThemeMacro } from './themeMacro';

describe('__theme', () => {
  const templateSrv = initTemplateSrv('theme', []);

  it('resolves a theme token path to its value', () => {
    expect(templateSrv.replace('color: ${__theme.colors.text.primary}')).toBe(
      `color: ${config.theme2.colors.text.primary}`
    );
  });

  it('resolves a number token to its string form', () => {
    expect(templateSrv.replace('${__theme.typography.fontSize}px')).toBe('14px');
  });

  it('applies the requested format to the token', () => {
    expect(templateSrv.replace('${__theme.typography.fontFamilyMonospace:html}')).toBe(
      '&#39;Roboto Mono&#39;, monospace'
    );
  });

  it.each([
    { desc: 'no path', target: '${__theme}' },
    { desc: 'an object', target: '${__theme.colors.text}' },
    { desc: 'a function', target: '${__theme.spacing}' },
    { desc: 'a missing path', target: '${__theme.colors.nope}' },
  ])('leaves $desc unresolved', ({ target }) => {
    expect(templateSrv.replace(target)).toBe(target);
  });

  it('reads the theme current at interpolation time', () => {
    const original = config.theme2;
    config.theme2 = { ...original, colors: { ...original.colors, text: { ...original.colors.text, primary: 'red' } } };

    try {
      expect(templateSrv.replace('${__theme.colors.text.primary}')).toBe('red');
    } finally {
      config.theme2 = original;
    }
  });

  describe('in scenes', () => {
    let unregister: () => void;
    const scene = new SceneFlexLayout({ children: [] });

    beforeAll(() => {
      unregister = sceneUtils.registerVariableMacro('__theme', ThemeMacro);
    });

    afterAll(() => {
      unregister();
    });

    it('resolves a theme token path to its value', () => {
      expect(sceneGraph.interpolate(scene, 'color: ${__theme.colors.text.primary}')).toBe(
        `color: ${config.theme2.colors.text.primary}`
      );
    });

    it('leaves a function token unresolved', () => {
      expect(sceneGraph.interpolate(scene, '${__theme.spacing}')).toBe('${__theme.spacing}');
    });

    it('resolves the token for the text format', () => {
      expect(sceneGraph.interpolate(scene, '${__theme.typography.fontSize:text}')).toBe('14');
    });
  });
});
