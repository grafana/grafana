import { NavModel } from '@grafana/data';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types';
import { StoreState } from 'app/types/store';

export const usePerconaNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const model = getNavModel(navIndex, id);

  model.pageTitle = `${model.main.text}: ${model.node.text}`;
  // Grafana's way to generate breadcrumbs is kinda weird, hence this change
  model.main.text = model.node.text;
  return model;
};
