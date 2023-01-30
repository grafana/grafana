import { useGrafana } from 'app/core/context/GrafanaContext';

export function DisabledOnChromelessRoutes(props: { children: React.ReactElement }): JSX.Element | null {
  const { chrome } = useGrafana();
  const state = chrome.useState();

  return state.chromeless ? null : props.children;
}
