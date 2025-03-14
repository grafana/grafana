import { render } from '@testing-library/react';
import {
  ComponentTypeWithExtensionMeta,
  PluginExtension,
  PluginExtensionComponentMeta,
  PluginExtensionTypes,
} from '@grafana/data';

import {
  createRegexFromPluginIdPatterns,
  getLimitedComponents,
  isPluginExtensionLink,
  renderLimitedComponents,
} from './utils';

describe('Plugin Extensions / Utils', () => {
  describe('isPluginExtensionLink()', () => {
    test('should return TRUE if the object is a link extension', () => {
      expect(
        isPluginExtensionLink({
          id: 'id',
          pluginId: 'plugin-id',
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtension)
      ).toBe(true);

      expect(
        isPluginExtensionLink({
          id: 'id',
          pluginId: 'plugin-id',
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
          onClick: () => {},
        } as PluginExtension)
      ).toBe(true);
    });
    test('should return FALSE if the object is NOT a link extension', () => {
      expect(
        isPluginExtensionLink({
          type: PluginExtensionTypes.link,
          title: 'Title',
          description: 'Description',
        } as PluginExtension)
      ).toBe(false);

      expect(
        // @ts-ignore (Right now we only have a single type of extension)
        isPluginExtensionLink({
          type: 'unknown',
          title: 'Title',
          description: 'Description',
          path: '...',
        } as PluginExtension)
      ).toBe(false);
    });
  });

  describe('createRegexFromGlobs()', () => {
    test('should return a regex that matches any of the patterns', () => {
      const regex = createRegexFromPluginIdPatterns(['grafana-foo-app', 'grafana-bar*']);

      expect(regex.test('grafana-foo-app')).toBe(true);
      expect(regex.test('grafana-bar-app')).toBe(true);
      expect(regex.test('grafana-bar2-app')).toBe(true);
      expect(regex.test('grafana-bar-app-2')).toBe(true);

      expect(regex.test('grafana-baz-app')).toBe(false);
      expect(regex.test('grafana-foobar-app')).toBe(false);
      expect(regex.test('myorg-grafana-bar-app')).toBe(false);
    });

    test('should return a regex that matches direct strings', () => {
      const regex = createRegexFromPluginIdPatterns(['grafana-csp-app']);

      expect(regex.test('grafana-csp-app')).toBe(true);

      expect(regex.test('grafana-csp2-app')).toBe(false);
      expect(regex.test('grafana-csp2-app2')).toBe(false);
      expect(regex.test('grafana-csp-app-foo')).toBe(false);
      expect(regex.test('ggrafana-csp-app')).toBe(false);
    });

    test('should not behave like a glob by default', () => {
      const regex = createRegexFromPluginIdPatterns(['grafana-adaptive']);

      expect(regex.test('grafana-adaptive')).toBe(true);

      expect(regex.test('grafana-adaptive-app')).toBe(false);
      expect(regex.test('grafana-adaptivemetrics-app')).toBe(false);
      expect(regex.test('grafana-adaptivelogs-app')).toBe(false);
    });
  });

  describe('getLimitedComponents()', () => {
    test('should return `null` if it receives an empty array of components', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [];
      const limitedComponents = getLimitedComponents({ props, components });
      expect(limitedComponents).toEqual(null);
    });

    test('should return all components if no limit is provided', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>),
        createComponent(() => <div>Test 2</div>),
        createComponent(() => <div>Test 3</div>),
      ];

      expect(getLimitedComponents({ props, components })?.length).toEqual(3);
    });

    test('should limit the number of components', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>),
        createComponent(() => <div>Test 2</div>),
        createComponent(() => <div>Test 3</div>),
        createComponent(() => <div>Test 4</div>),
        createComponent(() => <div>Test 5</div>),
      ];

      // Check if the limit is respected
      expect(getLimitedComponents({ props, components, limit: 1 })?.length).toEqual(1);
      expect(getLimitedComponents({ props, components, limit: 3 })?.length).toEqual(3);

      // Check if the right components are selected
      const limitedComponents = getLimitedComponents({ props, components, limit: 3 });
      const rendered = render(
        <>{limitedComponents?.map((Component, index) => <Component key={index} {...props} />)}</>
      );

      expect(rendered.getByText('Test 1')).toBeInTheDocument();
      expect(rendered.getByText('Test 2')).toBeInTheDocument();
      expect(rendered.getByText('Test 3')).toBeInTheDocument();
      expect(rendered.queryByText('Test 4')).not.toBeInTheDocument();
      expect(rendered.queryByText('Test 5')).not.toBeInTheDocument();
    });

    test('should filter components by pluginIdPatterns', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 2</div>, 'plugin-id-2'),
        createComponent(() => <div>Test 3</div>, 'plugin-id-3'),
        createComponent(() => <div>Test 4</div>, 'plugin-id-4'),
        createComponent(() => <div>Test 5</div>, 'plugin-id-5'),
      ];

      // Check if the filtering works
      expect(getLimitedComponents({ props, components, pluginIdPatterns: ['plugin-id-1'] })?.length).toEqual(1);
      expect(
        getLimitedComponents({ props, components, pluginIdPatterns: ['plugin-id-1', 'plugin-id-2'] })?.length
      ).toEqual(2);
      expect(getLimitedComponents({ props, components, pluginIdPatterns: ['plugin-id*'] })?.length).toEqual(5);

      // Check if the right components are selected
      const limitedComponents = getLimitedComponents({
        props,
        components,
        pluginIdPatterns: ['plugin-id-2', 'plugin-id-3'],
      });
      const rendered = render(
        <>{limitedComponents?.map((Component, index) => <Component key={index} {...props} />)}</>
      );

      expect(rendered.getByText('Test 2')).toBeInTheDocument();
      expect(rendered.getByText('Test 3')).toBeInTheDocument();
      expect(rendered.queryByText('Test 1')).not.toBeInTheDocument();
      expect(rendered.queryByText('Test 4')).not.toBeInTheDocument();
      expect(rendered.queryByText('Test 5')).not.toBeInTheDocument();
    });

    test('should filter components based on both limit and pluginIdPatterns', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 2</div>, 'plugin-id-2'),
        createComponent(() => <div>Test 3</div>, 'plugin-id-3'),
        createComponent(() => <div>Test 4</div>, 'plugin-id-4'),
        createComponent(() => <div>Test 5</div>, 'plugin-id-5'),
      ];

      // Check if the filtering works
      expect(getLimitedComponents({ props, components, limit: 1, pluginIdPatterns: ['plugin-id*'] })?.length).toEqual(
        1
      );
      expect(getLimitedComponents({ props, components, limit: 2, pluginIdPatterns: ['plugin-id-3'] })?.length).toEqual(
        1
      );
      expect(
        getLimitedComponents({
          props,
          components,
          limit: 1,
          pluginIdPatterns: ['plugin-id-1', 'plugin-id-2', 'plugin-id-3'],
        })?.length
      ).toEqual(1);
    });
  });

  describe('renderLimitedComponents()', () => {
    test('should render all components if no limit is provided', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 2</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 3</div>, 'plugin-id-2'),
        createComponent(() => <div>Test 4</div>, 'plugin-id-3'),
      ];

      const rendered = render(<>{renderLimitedComponents({ props, components })}</>);

      expect(rendered.getByText('Test 1')).toBeInTheDocument();
      expect(rendered.getByText('Test 2')).toBeInTheDocument();
      expect(rendered.getByText('Test 3')).toBeInTheDocument();
      expect(rendered.getByText('Test 4')).toBeInTheDocument();
    });

    test('should limit the number of components', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 2</div>, 'plugin-id-2'),
        createComponent(() => <div>Test 3</div>, 'plugin-id-3'),
      ];

      const rendered = render(<>{renderLimitedComponents({ props, components, limit: 1 })}</>);

      expect(rendered.getByText('Test 1')).toBeInTheDocument();
      expect(rendered.queryByText('Test 2')).not.toBeInTheDocument();
      expect(rendered.queryByText('Test 3')).not.toBeInTheDocument();
    });

    test('should filter components by pluginIdPatterns', () => {
      const props = {};
      const components: Array<ComponentTypeWithExtensionMeta<{}>> = [
        createComponent(() => <div>Test 1</div>, 'plugin-id-1'),
        createComponent(() => <div>Test 2</div>, 'plugin-id-2'),
        createComponent(() => <div>Test 3</div>, 'plugin-id-3'),
      ];

      const rendered = render(<>{renderLimitedComponents({ props, components, pluginIdPatterns: ['plugin-id-2'] })}</>);

      expect(rendered.getByText('Test 2')).toBeInTheDocument();
      expect(rendered.queryByText('Test 1')).not.toBeInTheDocument();
      expect(rendered.queryByText('Test 3')).not.toBeInTheDocument();
    });
  });
});

function createComponent<Props>(
  implementation?: (props: Props) => React.ReactNode,
  pluginId?: string
): ComponentTypeWithExtensionMeta<Props> {
  function ComponentWithMeta(props: Props) {
    if (implementation) {
      return implementation(props);
    }

    return <div>Test</div>;
  }

  ComponentWithMeta.displayName = '';
  ComponentWithMeta.propTypes = {};
  ComponentWithMeta.contextTypes = {};
  ComponentWithMeta.meta = {
    pluginId: pluginId ?? '',
    title: '',
    description: '',
    id: '',
    type: PluginExtensionTypes.component,
  } satisfies PluginExtensionComponentMeta;

  return ComponentWithMeta;
}
