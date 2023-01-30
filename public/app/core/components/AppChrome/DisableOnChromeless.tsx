import { useGrafana } from 'app/core/context/GrafanaContext';

export function DisabledOnChromeless(props: { children: React.ReactElement }): JSX.Element | null {
  const { chrome } = useGrafana();
  const state = chrome.useState();

  console.log('Disabled on chromless routes', state.chromeless);

  return state.chromeless ? null : props.children;
}
