import { useEffect } from 'react';

import { useGrafana } from 'app/core/context/GrafanaContext';

import { AddonAppDefinition } from '../AppChromeService';

export function DeclareAddonApp<T>(props: AddonAppDefinition<T>) {
  const { chrome } = useGrafana();

  useEffect(() => {
    //@ts-ignore
    chrome.addAddonApp(props);

    return () => {
      chrome.removeAddonApp(props.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chrome]);

  return null;
}
