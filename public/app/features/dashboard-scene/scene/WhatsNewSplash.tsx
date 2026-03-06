import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectRef, SceneObjectState } from '@grafana/scenes';
import { Icon, ScrollContainer, Stack, Text, Button, IconButton, useStyles2, useTheme2 } from '@grafana/ui';

import {
  FOOTER_HEIGHT,
  QUERY_EDITOR_TYPE_CONFIG,
  QueryEditorType,
  SIDEBAR_CARD_HEIGHT,
  SIDEBAR_CARD_INDENT,
  SIDEBAR_CARD_SPACING,
  SidebarSize,
  getQueryEditorColors,
} from '../panel-edit/PanelEditNext/constants';
import { getEditorBorderColor } from '../panel-edit/PanelEditNext/QueryEditor/utils';
import { CardTitle } from '../panel-edit/PanelEditNext/QueryEditor/Sidebar/CardTitle';
import { QuerySidebarCollapsableHeader } from '../panel-edit/PanelEditNext/QueryEditor/Sidebar/QuerySidebarCollapsableHeader';
import { SidebarHeaderActions } from '../panel-edit/PanelEditNext/QueryEditor/Sidebar/SidebarHeaderActions';
import { SegmentedToggle } from '../panel-edit/PanelEditNext/SegmentedToggle';
import { DashboardScene } from './DashboardScene';

interface WhatsNewSplashState extends SceneObjectState {
  dashboardRef: SceneObjectRef<DashboardScene>;
}

export class WhatsNewSplash extends SceneObjectBase<WhatsNewSplashState> {
  public onClose = () => {
    this.state.dashboardRef.resolve().closeModal();
  };

  static Component = WhatsNewSplashComponent;
}

type Concept = 'A' | 'B' | 'C';

interface ConceptProps {
  currentSlide: number;
  setCurrentSlide: (i: number) => void;
  onClose: () => void;
}

interface SlideContent {
  index: number;
  title: string;
  featureTitle: string;
  featureDescription: string;
  iconPath: string;
  tabLabel: string;
  tabIcon: string;
  heroContent: React.ReactNode;
}

type CardType = QueryEditorType.Query | QueryEditorType.Expression | QueryEditorType.Transformation;

interface MockCardProps {
  id: string;
  label: string;
  type: CardType;
  isSelected: boolean;
  onClick: () => void;
  hoverBg: string;
  styles: ReturnType<typeof getStackHeroStyles>;
}

function MockCard({ label, type, isSelected, onClick, hoverBg, styles }: MockCardProps) {
  const theme = useTheme2();
  const borderColor = getEditorBorderColor({ theme, editorType: type });
  const iconName = QUERY_EDITOR_TYPE_CONFIG[type].icon;
  const selectedBg = `color-mix(in srgb, ${borderColor} 10%, ${theme.colors.background.primary})`;

  return (
    <div
      className={styles.card}
      style={{
        borderLeft: `${isSelected ? 3 : 2}px solid ${borderColor}`,
        ...(isSelected && {
          borderColor,
          backgroundColor: selectedBg,
          boxShadow: `0 0 4px 0 color-mix(in srgb, ${borderColor} 40%, transparent)`,
        }),
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cardContent}>
        <Icon name={iconName} size="sm" color={borderColor} />
        <CardTitle title={label} isHidden={false} />
      </div>
      <div
        data-hover-actions=""
        className={styles.hoverActions}
        style={{ background: `linear-gradient(270deg, ${hoverBg} 70%, transparent 100%)` }}
      >
        <Icon name="trash-alt" size="sm" />
        <Icon name="copy" size="sm" />
        <Icon name="eye" size="sm" />
      </div>
    </div>
  );
}

function MockSidebarFooter() {
  const styles = useStyles2(getMockFooterStyles);
  return (
    <div className={styles.footer}>
      <Text weight="medium" variant="bodySmall">
        6 items
      </Text>
      <Stack direction="row" alignItems="center" gap={2}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="eye" size="sm" className={styles.icon} />
          <Text weight="medium" variant="bodySmall">
            6
          </Text>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="eye-slash" size="sm" className={styles.icon} />
          <Text weight="medium" variant="bodySmall">
            0
          </Text>
        </Stack>
      </Stack>
    </div>
  );
}

function StackHero() {
  const [selectedId, setSelectedId] = useState('B');
  const [queriesOpen, setQueriesOpen] = useState(true);
  const [transformsOpen, setTransformsOpen] = useState(true);
  const styles = useStyles2(getStackHeroStyles);
  const cardColors = useStyles2(getQueryEditorColors);
  const hoverBg = cardColors.card.hoverBg;

  const queryCards: Array<{ id: string; label: string; type: CardType }> = [
    { id: 'A', label: 'A', type: QueryEditorType.Query },
    { id: 'B', label: 'B', type: QueryEditorType.Query },
    { id: 'C', label: 'C', type: QueryEditorType.Expression },
    { id: 'D', label: 'D', type: QueryEditorType.Query },
  ];

  const transformCards: Array<{ id: string; label: string; type: CardType }> = [
    { id: 'filter', label: 'Filter by name', type: QueryEditorType.Transformation },
    { id: 'group', label: 'Group by', type: QueryEditorType.Transformation },
  ];

  return (
    <div className={styles.container}>
      <SidebarHeaderActions sidebarSize={SidebarSize.Full} setSidebarSize={() => {}}>
        <SegmentedToggle
          options={[
            { value: QueryEditorType.Query, label: 'Data', icon: 'database' },
            { value: QueryEditorType.Alert, label: 'Alerts (0)', icon: 'bell' },
          ]}
          value={QueryEditorType.Query}
          onChange={() => {}}
          showBackground={false}
        />
      </SidebarHeaderActions>

      <ScrollContainer overflowX="hidden">
        <div className={styles.content}>
          <QuerySidebarCollapsableHeader
            label="Queries & Expressions"
            isOpen={queriesOpen}
            onToggle={setQueriesOpen}
          >
            {queryCards.map((card) => (
              <MockCard
                key={card.id}
                {...card}
                isSelected={selectedId === card.id}
                onClick={() => setSelectedId(card.id)}
                hoverBg={hoverBg}
                styles={styles}
              />
            ))}
          </QuerySidebarCollapsableHeader>

          <QuerySidebarCollapsableHeader
            label="Transformations"
            isOpen={transformsOpen}
            onToggle={setTransformsOpen}
          >
            {transformCards.map((card) => (
              <MockCard
                key={card.id}
                {...card}
                isSelected={selectedId === card.id}
                onClick={() => setSelectedId(card.id)}
                hoverBg={hoverBg}
                styles={styles}
              />
            ))}
          </QuerySidebarCollapsableHeader>
        </div>
      </ScrollContainer>

      <MockSidebarFooter />
    </div>
  );
}

function TransformationsHero() {
  const styles = useStyles2(getHeroStyles);
  const transformations = [
    'Filter by name',
    'Merge series/tables',
    'Group by',
    'Add field from calculation',
    'Rename by regex',
  ];

  return (
    <div className={styles.queryEditor}>
      <div className={styles.editorHeader}>
        <div className={styles.tabBar}>
          <span className={styles.inactiveTab}>Data</span>
          <span className={styles.activeTab}>Transform</span>
        </div>
      </div>
      <div className={styles.queriesSection}>
        <div className={styles.queriesLabel}>
          <span>Transformations</span>
          <div className={styles.addBtn}>+</div>
        </div>
        <div className={styles.queryList}>
          {transformations.map((t, i) => (
            <div key={t} className={i === 1 ? styles.queryItemActive : styles.queryItem}>
              <div className={styles.queryItemIcon} />
              <span className={styles.queryItemLabel}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertingHero() {
  const styles = useStyles2(getHeroStyles);
  return (
    <div className={styles.queryEditor}>
      <div className={styles.editorHeader}>
        <div className={styles.tabBar}>
          <span className={styles.inactiveTab}>Data</span>
          <span className={styles.activeTab}>Alerts (3)</span>
        </div>
      </div>
      <div className={styles.queriesSection}>
        <div className={styles.queriesLabel}>
          <span>Alert rules</span>
        </div>
        <div className={styles.queryList}>
          {['High CPU usage', 'Memory threshold', 'Error rate spike'].map((rule, i) => (
            <div key={rule} className={i === 0 ? styles.queryItemActive : styles.queryItem}>
              <div className={styles.alertDot} />
              <span className={styles.queryItemLabel}>{rule}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SLIDES: Omit<SlideContent, 'heroContent'>[] = [
  {
    index: 0,
    title: 'Flexible query experience',
    featureTitle: 'Build and compose queries with ease',
    featureDescription:
      'Build complex queries with multiple data sources, transformations, and expressions with more clarity. The new stack component gives you a bird\'s eye view of your data structure and frees up your workspace.',
    iconPath: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    tabLabel: 'Query stack',
    tabIcon: 'layers-alt',
  },
  {
    index: 1,
    title: 'Powerful transformations',
    featureTitle: 'Reshape your data on the fly',
    featureDescription:
      'Chain multiple transformations to filter, join, group, and compute new fields from your raw data. No need to modify your queries — transform the results directly in Grafana.',
    iconPath: 'M4 6h16M4 12h16M4 18h7',
    tabLabel: 'Transformations',
    tabIcon: 'shuffle',
  },
  {
    index: 2,
    title: 'Unified alerting',
    featureTitle: 'Alerts built right into your dashboards',
    featureDescription:
      'Create and manage alert rules directly from the panel editor. Get notified when your metrics cross thresholds, and see alert states inline with your data.',
    iconPath: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    tabLabel: 'Alerting',
    tabIcon: 'bell',
  },
];

const HERO_COMPONENTS = [StackHero, TransformationsHero, AlertingHero];

function ConceptSwitcher({
  concept,
  setConcept,
}: {
  concept: Concept;
  setConcept: (c: Concept) => void;
}) {
  const styles = useStyles2(getConceptSwitcherStyles);
  return (
    <div className={styles.pill} onClick={(e) => e.stopPropagation()}>
      {(['A', 'B', 'C'] as Concept[]).map((c) => (
        <button key={c} className={c === concept ? styles.btnActive : styles.btn} onClick={() => setConcept(c)}>
          {c}
        </button>
      ))}
    </div>
  );
}

function ConceptA({ currentSlide, setCurrentSlide, onClose }: ConceptProps) {
  const styles = useStyles2(getStyles);
  const slide = SLIDES[currentSlide];
  const HeroComponent = HERO_COMPONENTS[currentSlide];
  const totalSlides = SLIDES.length;

  const goNext = () => setCurrentSlide(Math.min(currentSlide + 1, totalSlides - 1));
  const goPrev = () => setCurrentSlide(Math.max(currentSlide - 1, 0));

  return (
    <>
      <div className={styles.heroPane}>
        <HeroComponent />
      </div>
      <div className={styles.contentPane}>
        <div className={styles.closeBtn}>
          <IconButton name="times" tooltip="Close" onClick={onClose} size="xl" />
        </div>

        <div className={styles.badge}>NEW IN GRAFANA 13</div>

        <div className={styles.slideCounter}>
          {currentSlide + 1}/{totalSlides}
        </div>

        <h1 className={styles.title}>{slide.title}</h1>

        <div className={styles.featureBlock}>
          <div className={styles.featureIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} width={32} height={32}>
              <path strokeLinecap="round" strokeLinejoin="round" d={slide.iconPath} />
            </svg>
          </div>
          <h3 className={styles.featureTitle}>{slide.featureTitle}</h3>
          <p className={styles.featureDescription}>{slide.featureDescription}</p>
        </div>

        <div className={styles.footer}>
          <div className={styles.pagination}>
            <button className={styles.arrowBtn} onClick={goPrev} disabled={currentSlide === 0} aria-label="Previous">
              ‹
            </button>
            <div className={styles.dots}>
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className={i === currentSlide ? styles.dotActive : styles.dot}
                  onClick={() => setCurrentSlide(i)}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
            <button
              className={styles.arrowBtn}
              onClick={goNext}
              disabled={currentSlide === totalSlides - 1}
              aria-label="Next"
            >
              ›
            </button>
          </div>

          <Button variant="primary" onClick={onClose}>
            Got it!
          </Button>
        </div>
      </div>
    </>
  );
}

function ConceptB({ currentSlide, setCurrentSlide, onClose }: ConceptProps) {
  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;
  const progressPct = ((currentSlide + 1) / SLIDES.length) * 100;
  const styles = useStyles2(getConceptBStyles);
  const sharedStyles = useStyles2(getStyles);

  return (
    <>
      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
      </div>

      <div className={sharedStyles.heroPane}>
        <StackHero />
      </div>

      <div className={sharedStyles.contentPane}>
        <div className={styles.badgeRow}>
          <span className={sharedStyles.badge}>NEW IN GRAFANA</span>
          <span className={styles.slideCountInline}>
            {currentSlide + 1} of {SLIDES.length}
          </span>
        </div>

        <div className={styles.numberBadge}>{currentSlide + 1}</div>

        <h2 className={sharedStyles.featureTitle}>{slide.featureTitle}</h2>
        <p className={sharedStyles.featureDescription}>{slide.featureDescription}</p>

        <div className={sharedStyles.footer}>
          <button className={styles.skipBtn} onClick={onClose}>
            Skip all
          </button>
          {isLast ? (
            <Button variant="primary" onClick={onClose}>
              Got it!
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setCurrentSlide(currentSlide + 1)}>
              Next <Icon name="arrow-right" size="sm" />
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function ConceptC({ currentSlide, setCurrentSlide, onClose }: ConceptProps) {
  const slide = SLIDES[currentSlide];
  const styles = useStyles2(getConceptCStyles);
  const sharedStyles = useStyles2(getStyles);

  return (
    <>
      <div className={sharedStyles.heroPane}>
        <StackHero />
      </div>

      <div className={sharedStyles.contentPane}>
        <div className={sharedStyles.closeBtn}>
          <IconButton name="times" tooltip="Close" onClick={onClose} size="xl" />
        </div>

        <span className={sharedStyles.badge}>NEW IN GRAFANA</span>

        <div className={styles.tabRow}>
          {SLIDES.map((s, i) => (
            <button
              key={i}
              className={cx(styles.tab, { [styles.tabActive]: i === currentSlide })}
              onClick={() => setCurrentSlide(i)}
            >
              <Icon name={s.tabIcon as any} size="sm" />
              {s.tabLabel}
            </button>
          ))}
        </div>

        <h2 className={sharedStyles.featureTitle}>{slide.featureTitle}</h2>
        <p className={sharedStyles.featureDescription}>{slide.featureDescription}</p>

        <div className={sharedStyles.footer}>
          <a
            href="https://grafana.com/docs/grafana/latest/whatsnew/"
            target="_blank"
            rel="noreferrer"
            className={styles.changelogLink}
          >
            <Icon name="external-link-alt" size="sm" /> Read full changelog
          </a>
          <Button variant="secondary" onClick={onClose}>
            Got it!
          </Button>
        </div>
      </div>
    </>
  );
}

function WhatsNewSplashComponent({ model }: SceneComponentProps<WhatsNewSplash>) {
  const styles = useStyles2(getStyles);
  const [concept, setConcept] = useState<Concept>('A');
  const [currentSlide, setCurrentSlide] = useState(0);

  const props: ConceptProps = { currentSlide, setCurrentSlide, onClose: model.onClose };

  return (
    <div className={styles.backdrop} onClick={model.onClose}>
      <ConceptSwitcher
        concept={concept}
        setConcept={(c) => {
          setConcept(c);
          setCurrentSlide(0);
        }}
      />
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {concept === 'A' && <ConceptA {...props} />}
        {concept === 'B' && <ConceptB {...props} />}
        {concept === 'C' && <ConceptC {...props} />}
      </div>
    </div>
  );
}

function getStackHeroStyles(theme: GrafanaTheme2) {
  const cardColors = getQueryEditorColors(theme).card;

  return {
    // Matches QueryEditorSidebar container
    container: css({
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.primary,
    }),
    // Matches QueryEditorSidebar content div
    content: css({
      background: theme.colors.background.primary,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    }),
    // Matches SidebarCard wrapper + card
    card: css({
      position: 'relative',
      minHeight: SIDEBAR_CARD_HEIGHT,
      marginLeft: theme.spacing(SIDEBAR_CARD_INDENT),
      marginRight: theme.spacing(SIDEBAR_CARD_INDENT),
      marginBottom: theme.spacing(SIDEBAR_CARD_SPACING),
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      border: `1px solid ${theme.colors.border.medium}`,
      background: cardColors.bg,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      overflow: 'hidden',
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['background-color', 'box-shadow'], {
          duration: theme.transitions.duration.standard,
        }),
      },
      '&:hover': {
        background: cardColors.hoverBg,
      },
      '&:hover [data-hover-actions]': {
        opacity: 1,
        transform: 'translateX(0)',
        pointerEvents: 'auto',
      },
    }),
    // Matches SidebarCard cardContent
    cardContent: css({
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(0.5, 1, 0.5, 1.25),
      overflow: 'hidden',
      minWidth: 0,
      flex: 1,
    }),
    // Matches SidebarCard hoverActions
    hoverActions: css({
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      display: 'flex',
      alignItems: 'center',
      paddingRight: theme.spacing(1),
      paddingLeft: theme.spacing(3),
      borderRadius: `0 ${theme.shape.radius.default} ${theme.shape.radius.default} 0`,
      opacity: 0,
      transform: 'translateX(8px)',
      pointerEvents: 'none',
      color: theme.colors.text.secondary,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: theme.transitions.create(['opacity', 'transform'], {
          duration: theme.transitions.duration.standard,
        }),
      },
    }),
  };
}

function getMockFooterStyles(theme: GrafanaTheme2) {
  const themeColors = getQueryEditorColors(theme);
  return {
    footer: css({
      marginTop: 'auto',
      background: themeColors.sidebarFooterBackground,
      padding: theme.spacing(0, 1.5),
      height: FOOTER_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
      borderTop: `1px solid ${theme.colors.border.weak}`,
    }),
    icon: css({ color: theme.colors.text.secondary }),
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    backdrop: css({
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: theme.zIndex.modal,
    }),
    modal: css({
      display: 'flex',
      width: '900px',
      maxWidth: '95vw',
      height: '560px',
      maxHeight: '90vh',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: `0 0 48px 0 #45556C`,
      backgroundColor: theme.colors.background.primary,
      position: 'relative',
    }),
    heroPane: css({
      width: '44%',
      flexShrink: 0,
      backgroundColor: theme.colors.background.canvas,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(3),
    }),
    contentPane: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(4),
      position: 'relative',
      overflow: 'auto',
    }),
    closeBtn: css({
      position: 'absolute',
      top: theme.spacing(2),
      right: theme.spacing(2),
    }),
    badge: css({
      display: 'inline-block',
      alignSelf: 'flex-start',
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      border: `1px solid ${theme.colors.success.border}`,
      borderRadius: theme.shape.radius.pill,
      color: theme.colors.success.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: theme.typography.fontFamilyMonospace,
      letterSpacing: '0.08em',
      marginBottom: theme.spacing(3),
    }),
    slideCounter: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: theme.spacing(1),
    }),
    title: css({
      fontSize: '1.75rem',
      fontWeight: theme.typography.fontWeightBold,
      color: theme.colors.text.primary,
      margin: 0,
      marginBottom: theme.spacing(4),
      lineHeight: 1.2,
    }),
    featureBlock: css({
      flex: 1,
    }),
    featureIcon: css({
      width: 48,
      height: 48,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: `${theme.v1.palette.orange}22`,
      borderRadius: theme.shape.radius.default,
      color: theme.v1.palette.orange,
      marginBottom: theme.spacing(2),
    }),
    featureTitle: css({
      fontSize: theme.typography.h4.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.primary,
      margin: 0,
      marginBottom: theme.spacing(1.5),
    }),
    featureDescription: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.body.fontSize,
      lineHeight: 1.6,
      margin: 0,
    }),
    footer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: theme.spacing(4),
    }),
    pagination: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    arrowBtn: css({
      background: 'none',
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.primary,
      width: 28,
      height: 28,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '1.2rem',
      lineHeight: 1,
      padding: 0,
      '&:disabled': {
        opacity: 0.3,
        cursor: 'default',
      },
      '&:hover:not(:disabled)': {
        backgroundColor: theme.colors.action.hover,
      },
    }),
    dots: css({
      display: 'flex',
      gap: theme.spacing(0.75),
      alignItems: 'center',
    }),
    dot: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: theme.colors.border.medium,
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      '&:hover': {
        backgroundColor: theme.colors.text.secondary,
      },
    }),
    dotActive: css({
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: theme.v1.palette.orange,
      border: 'none',
      cursor: 'pointer',
      padding: 0,
    }),
  };
}

function getConceptSwitcherStyles(theme: GrafanaTheme2) {
  return {
    pill: css({
      position: 'fixed',
      top: theme.spacing(2),
      right: theme.spacing(2),
      zIndex: theme.zIndex.modal + 1,
      display: 'flex',
      gap: theme.spacing(0.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(0.5),
    }),
    btn: css({
      width: 28,
      height: 28,
      borderRadius: theme.shape.radius.pill,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    btnActive: css({
      width: 28,
      height: 28,
      borderRadius: theme.shape.radius.pill,
      border: 'none',
      background: theme.v1.palette.orange,
      color: '#fff',
      cursor: 'pointer',
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}

function getConceptBStyles(theme: GrafanaTheme2) {
  return {
    progressTrack: css({
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      background: theme.colors.border.weak,
      zIndex: 1,
    }),
    progressFill: css({
      height: '100%',
      background: theme.v1.palette.orange,
      transition: 'width 300ms ease',
    }),
    badgeRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      marginBottom: theme.spacing(3),
    }),
    slideCountInline: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    numberBadge: css({
      width: 40,
      height: 40,
      background: theme.v1.palette.orange,
      borderRadius: theme.shape.radius.default,
      color: '#fff',
      fontWeight: theme.typography.fontWeightBold,
      fontSize: '1.2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(2),
    }),
    skipBtn: css({
      background: 'none',
      border: 'none',
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.body.fontSize,
      padding: 0,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}

function getConceptCStyles(theme: GrafanaTheme2) {
  return {
    tabRow: css({
      display: 'flex',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      marginBottom: theme.spacing(3),
      gap: 0,
    }),
    tab: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      padding: theme.spacing(1, 1.5),
      background: 'none',
      border: 'none',
      borderBottom: '2px solid transparent',
      color: theme.colors.text.secondary,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: -1,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    tabActive: css({
      color: theme.colors.text.primary,
      borderBottom: `2px solid ${theme.v1.palette.orange}`,
    }),
    changelogLink: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      color: theme.colors.text.secondary,
      textDecoration: 'none',
      fontSize: theme.typography.body.fontSize,
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
}

function getHeroStyles(theme: GrafanaTheme2) {
  return {
    queryEditor: css({
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2),
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    editorHeader: css({
      marginBottom: theme.spacing(1),
    }),
    tabBar: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),
    }),
    activeTab: css({
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      backgroundColor: theme.colors.background.primary,
      borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
      color: theme.colors.text.primary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    inactiveTab: css({
      padding: `${theme.spacing(0.5)} ${theme.spacing(1.5)}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    queriesSection: css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
    }),
    queriesLabel: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      marginBottom: theme.spacing(1),
      padding: `0 ${theme.spacing(0.5)}`,
    }),
    addBtn: css({
      width: 20,
      height: 20,
      backgroundColor: theme.colors.primary.main,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.primary.contrastText,
      fontSize: '0.9rem',
      cursor: 'pointer',
    }),
    queryList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      flex: 1,
      overflow: 'hidden',
    }),
    queryItem: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.colors.border.weak}`,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    queryItemActive: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
      borderRadius: theme.shape.radius.default,
      border: `1px solid ${theme.v1.palette.orange}`,
      color: theme.colors.text.primary,
      backgroundColor: `${theme.v1.palette.orange}18`,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    queryItemIcon: css({
      width: 14,
      height: 14,
      borderRadius: '50%',
      backgroundColor: theme.v1.palette.orange,
      flexShrink: 0,
    }),
    queryItemLabel: css({
      flex: 1,
    }),
    alertDot: css({
      width: 10,
      height: 10,
      borderRadius: '50%',
      backgroundColor: theme.colors.error.main,
      flexShrink: 0,
    }),
    statusBar: css({
      display: 'flex',
      gap: theme.spacing(2),
      marginTop: theme.spacing(1),
      color: theme.colors.text.disabled,
      fontSize: theme.typography.bodySmall.fontSize,
      padding: `${theme.spacing(0.5)} ${theme.spacing(0.5)}`,
    }),
  };
}
