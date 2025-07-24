import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { userEvent } from 'test/test-utils';

import { CustomVariable, SceneVariable, SceneVariableSet } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import { RepeatRowSelect2 } from './RepeatRowSelect';

async function buildTestScene(variables?: SceneVariable[]) {
  const dashboard = new DashboardScene({
    uid: 'A',
    $variables: new SceneVariableSet({
      variables: variables ?? [],
    }),
  });

  activateFullSceneTree(dashboard);
  await new Promise((r) => setTimeout(r, 1));
  return dashboard;
}

const Wrapper = ({ scene }: { scene: DashboardScene }) => {
  const [repeat, setRepeat] = useState<string | undefined>(undefined);
  return <RepeatRowSelect2 sceneContext={scene} repeat={repeat} onChange={(newRepeat) => setRepeat(newRepeat)} />;
};

const setup = async (variables?: SceneVariable[]) => {
  const scene = await buildTestScene(variables);

  return render(<Wrapper scene={scene} />);
};

describe('RepeatRowSelect2', () => {
  beforeAll(() => {
    const mockGetBoundingClientRect = jest.fn(() => ({
      width: 120,
      height: 120,
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
    }));

    Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
      value: mockGetBoundingClientRect,
    });
  });

  it('should render correct options', async () => {
    const variableA = new CustomVariable({
      name: 'testVar',
      query: 'test, test2',
      value: 'test',
      text: 'testVar',
    });
    const variableB = new CustomVariable({
      name: 'otherVar',
      query: 'test, test2',
      value: 'test',
      text: 'otherVar',
    });

    await setup([variableA, variableB]);

    const input = screen.getByRole('combobox');

    expect(input).not.toBeDisabled();
    expect(input).toHaveProperty('placeholder', 'Choose');
    await userEvent.click(input);

    expect(await screen.findByText(/Disable repeating/)).toBeInTheDocument();
    expect(screen.getByText(/testVar/)).toBeInTheDocument();
    expect(screen.getByText(/otherVar/)).toBeInTheDocument();
  });

  it('should be disabled when there are no template variables', async () => {
    await setup();

    expect(screen.getByRole('combobox')).toHaveProperty('placeholder', 'No template variables found');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
