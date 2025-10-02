/**
 * Logger utility for the dependency graph feature
 * Provides structured logging with different levels and contexts
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  component?: string;
  action?: string;
  data?: any;
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` [${JSON.stringify(context)}]` : '';
    return `[${timestamp}] [${level}] DependencyGraph: ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context), error);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// Create a singleton logger instance
export const logger = new Logger(process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO);

// Convenience functions for common logging scenarios
export const logGraphData = (data: any) => {
  logger.debug('Graph data processed', {
    component: 'DependencyGraph',
    action: 'dataProcessing',
    data: {
      nodes: data.nodes?.length || 0,
      dependencies: data.dependencies?.length || 0,
      extensionPoints: data.extensionPoints?.length || 0,
    },
  });
};

export const logAutoSizer = (width: number) => {
  logger.debug('AutoSizer width calculated', {
    component: 'AutoSizer',
    action: 'widthCalculation',
    data: { width },
  });
};

export const logError = (error: Error, context?: LogContext) => {
  logger.error('Error occurred', error, context);
};
