import { NavModel } from '@grafana/data';
import { useSelector } from 'react-redux';
import { StoreState } from 'app/types/store';
import { getNavModel } from 'app/core/selectors/navModel';

export const usePerconaNavModel = (id: string): NavModel => {
  const navIndex = useSelector((state: StoreState) => state.navIndex);
  const model = getNavModel(navIndex, id);

  model.pageTitle = `${model.main.text}: ${model.node.text}`;
  // Grafana's way to generate breadcrumbs is kinda weird, hence this change
  model.main.text = model.node.text;
  return model;
};
