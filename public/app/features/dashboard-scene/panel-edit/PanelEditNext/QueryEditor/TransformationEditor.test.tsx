import { render, screen } from '@testing-library/react';

import { type TransformerRegistryItem, type TransformerUIProps } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { TransformationEditor } from './TransformationEditor';
import { type Transformation } from './types';

interface TestOptions {
  rules?: unknown[];
}

/**
 * A plugin editor that reads its options without checking them, the way
 * `GroupToNestedTableTransformerEditor` reads `rule.aggregations.length`.
 */
function PluginEditor({ options }: TransformerUIProps<TestOptions>) {
  if (!Array.isArray(options.rules)) {
    throw new Error("Cannot read properties of undefined (reading 'length')");
  }

  return <div data-testid="plugin-editor" />;
}

// One item, so `Editor` keeps its component identity across a rerender: a new one would remount the
// tree and clear the boundary without the dependency having anything to do with it.
const registryItem: TransformerRegistryItem<TestOptions> = {
  id: 'test-transform',
  name: 'Test Transform',
  transformation: () => Promise.resolve({ id: 'test-transform', name: 'Test Transform', operator: jest.fn() }),
  editor: PluginEditor,
  imageDark: '',
  imageLight: '',
};

/** The selected transformation at a fixed index, carrying the options a dashboard supplied. */
function transformation(options: TestOptions): Transformation {
  return {
    transformId: 'test-transform-0',
    transformConfig: { id: 'test-transform', options },
    registryItem,
  };
}

function editor(selected: Transformation) {
  return <TransformationEditor transformation={selected} inputData={[]} onUpdate={jest.fn()} />;
}

const editorContainer = selectors.components.TransformTab.transformationEditor('Test Transform');

describe('TransformationEditor', () => {
  it('bounds a plugin editor that cannot read the options a dashboard supplied', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(editor(transformation({})));

    expect(screen.queryByTestId('plugin-editor')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // The container survives, so a throw in the plugin's editor costs the user that editor rather
    // than the pane it sits in.
    expect(screen.getByTestId(editorContainer)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it('clears a plugin editor that threw when a transformation of the same type takes its index', () => {
    // The `key` this is mounted under is the transformation's id and index, so deleting a throwing
    // transformation and letting a successor of the same type slide into its index does not remount
    // it. Without a dependency the alert would stand over a plugin editor that renders perfectly
    // well, and nothing in the transformations view would bring it back.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(editor(transformation({})));

    expect(screen.queryByTestId('plugin-editor')).not.toBeInTheDocument();

    rerender(editor(transformation({ rules: [] })));

    expect(screen.getByTestId('plugin-editor')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    consoleError.mockRestore();
  });
});
