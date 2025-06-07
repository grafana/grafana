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
  it('should render correct options', async () => {
    const variableA = new CustomVariable({
      name: 'customVar',
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

    expect(screen.getByRole('combobox')).not.toBeDisabled();
    expect(screen.getByRole('combobox')).toHaveProperty('placeholder', 'Choose');
    await userEvent.click(screen.getByRole('combobox'));

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
