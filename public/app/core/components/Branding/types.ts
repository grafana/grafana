import { FooterLink } from '../Footer/Footer';

export interface BrandingSettings {
  footerLinks: FooterLink[] | null;
  appTitle: string;
  loginSubtitle: string;
  loginTitle: string;
  loginLogo: string;
  loginBackground: string;
  loginBoxBackground: string;
  menuLogo: string;
  favIcon: string;
  loadingLogo: string;
  appleTouchIcon: string;
}
