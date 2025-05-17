import { PromQueryModellerInterface } from '../types/interfaces';

class QueryModellerRegistry {
  private static instance: PromQueryModellerInterface;

  static setQueryModeller(modeller: PromQueryModellerInterface) {
    this.instance = modeller;
  }

  static getQueryModeller(): PromQueryModellerInterface {
    if (!this.instance) {
      throw new Error('QueryModeller not initialized');
    }
    return this.instance;
  }
}

export const queryModellerRegistry = QueryModellerRegistry;
